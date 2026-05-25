import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { AiConfig, EditorJsonDocument, EditorJsonFragment, EditorTheme } from '../schema/types';
import { callAiEndpoint } from '../ai/aiClient';
import { LuChevronDown, LuEllipsisVertical, LuLayoutTemplate, LuPlus, LuSparkles, LuTrash2, LuCopy, LuImage } from 'react-icons/lu';
import { BLOCK_DRAG_MIME } from '../utils/dragDrop';

type HoveredSection = {
  id: string | null;
  pos: number;
  nodeSize: number;
  rect: DOMRect;
  zone: 'top' | 'bottom' | null;
};

type TemplateItem = {
  id: string;
  label: string;
  description: string;
  build: () => EditorJsonFragment;
};

function createBlankSection(content: EditorJsonFragment[] = [{ type: 'paragraph' }]): EditorJsonFragment {
  return {
    type: 'section',
    attrs: { id: crypto.randomUUID(), variant: 'default', cardWidth: 'md', paddingY: 'md', fullBleed: true, contentAlign: 'top' },
    content,
  };
}

const TEMPLATES: TemplateItem[] = [
  {
    id: 'hero-intro',
    label: 'Hero intro',
    description: 'Big heading + supporting paragraph',
    build: () =>
      createBlankSection([
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Your section title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Add a concise paragraph that explains this section.' }],
        },
      ]),
  },
  {
    id: 'split-columns',
    label: 'Two columns',
    description: 'Responsive content row',
    build: () =>
      createBlankSection([
        {
          type: 'flexRow',
          attrs: { id: crypto.randomUUID(), gap: 'md', responsive: 'stackOnMobile' },
          content: [
            { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: '50' }, content: [{ type: 'paragraph' }] },
            { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: '50' }, content: [{ type: 'paragraph' }] },
          ],
        },
      ]),
  },
  {
    id: 'feature-callout',
    label: 'Feature callout',
    description: 'Heading + callout card',
    build: () =>
      createBlankSection([
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Highlight a key feature' }] },
        {
          type: 'callout',
          attrs: { id: crypto.randomUUID(), icon: '✨', variant: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use this area for a strong value statement.' }] }],
        },
      ]),
  },
];

const DEFAULT_SYSTEM_COLORS = [
  '#ffffff',
  '#f8fafc',
  '#e2e8f0',
  '#cbd5e1',
  '#fee2e2',
  '#ffedd5',
  '#fef3c7',
  '#ecfccb',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
  '#dcfce7',
];

const DEFAULT_THEME_COLORS = ['#d8aff8', '#4f46e5', '#1f2937', '#000000'];

export function SectionAddControls({ editor, aiConfig, theme }: { editor: Editor; aiConfig?: AiConfig; theme?: EditorTheme }) {
  const [hovered, setHovered] = useState<HoveredSection | null>(null);
  const [txTick, setTxTick] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cardColorPickerOpen, setCardColorPickerOpen] = useState(false);
  const [backdropColorPickerOpen, setBackdropColorPickerOpen] = useState(false);

  const hoveredRef = useRef<HoveredSection | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const controlsRef = useRef<HTMLDivElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const sectionControlsRef = useRef<HTMLDivElement>(null);
  const sectionHandleRef = useRef<HTMLButtonElement>(null);
  const actionPanelRef = useRef<HTMLDivElement>(null);
  const stylePanelRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  useEffect(() => {
    if (hovered) return;
    setTemplateOpen(false);
    setActionsOpen(false);
    setStyleOpen(false);
    setAiOpen(false);
    setCardColorPickerOpen(false);
    setBackdropColorPickerOpen(false);
  }, [hovered]);

  useEffect(() => {
    const onTransaction = () => setTxTick((v) => v + 1);
    editor.on('transaction', onTransaction);
    return () => {
      editor.off('transaction', onTransaction);
    };
  }, [editor]);

  const findSectionPosById = useCallback(
    (id: string | null): number | null => {
      if (!id) return null;
      let found: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'section' && node.attrs?.id === id) {
          found = pos;
          return false;
        }
        return true;
      });
      return found;
    },
    [editor],
  );

  const getSectionAt = useCallback(
    (clientX: number, clientY: number): HoveredSection | null => {
      const pos = editor.view.posAtCoords({ left: clientX, top: clientY });
      if (!pos) return null;

      try {
        const $pos = editor.state.doc.resolve(pos.pos);
        for (let d = $pos.depth; d >= 1; d--) {
          const node = $pos.node(d);
          if (node.type.name !== 'section') continue;
          const sectionPos = $pos.before(d);
          const dom = editor.view.nodeDOM(sectionPos);
          if (!(dom instanceof Element)) return null;
          const rect = dom.getBoundingClientRect();
          const id = typeof node.attrs?.id === 'string' ? node.attrs.id : null;
          const edge = 30;
          if (clientY - rect.top <= edge) {
            return { id, pos: sectionPos, nodeSize: node.nodeSize, rect, zone: 'top' };
          }
          if (rect.bottom - clientY <= edge) {
            return { id, pos: sectionPos, nodeSize: node.nodeSize, rect, zone: 'bottom' };
          }
          return { id, pos: sectionPos, nodeSize: node.nodeSize, rect, zone: null };
        }
      } catch {
        return null;
      }

      return null;
    },
    [editor],
  );

  useEffect(() => {
    const container = editor.view.dom.closest('.ae-editor-root') as HTMLElement | null;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      const inControls =
        !!controlsRef.current?.contains(target) ||
        !!templatesRef.current?.contains(target) ||
        !!sectionControlsRef.current?.contains(target) ||
        !!sectionHandleRef.current?.contains(target) ||
        !!actionPanelRef.current?.contains(target) ||
        !!stylePanelRef.current?.contains(target) ||
        !!aiPanelRef.current?.contains(target);
      if (inControls) {
        clearTimeout(hideTimerRef.current);
        return;
      }

      if (!container.contains(target)) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setHovered(null);
          setTemplateOpen(false);
        }, 220);
        return;
      }

      clearTimeout(hideTimerRef.current);
      const section = getSectionAt(e.clientX, e.clientY);
      setHovered(section);
      if (!section || section.zone === null) setTemplateOpen(false);
    };

    const onScroll = () => {
      if (!hoveredRef.current) return;
      const dom = editor.view.nodeDOM(hoveredRef.current.pos);
      if (!(dom instanceof Element)) return;
      const rect = dom.getBoundingClientRect();
      setHovered((prev) => (prev ? { ...prev, rect } : null));
    };

    document.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(hideTimerRef.current);
    };
  }, [editor, getSectionAt]);

  useEffect(() => {
    const all = editor.view.dom.querySelectorAll('[data-type="section"][data-ae-section-hovered="true"]');
    all.forEach((el) => el.removeAttribute('data-ae-section-hovered'));
    if (!hovered) return;
    const dom = editor.view.nodeDOM(hovered.pos);
    if (dom instanceof Element) {
      dom.setAttribute('data-ae-section-hovered', 'true');
    }
  }, [editor, hovered]);

  useEffect(() => {
    if (!templateOpen && !actionsOpen && !styleOpen && !aiOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        templatesRef.current?.contains(target) ||
        controlsRef.current?.contains(target) ||
        sectionControlsRef.current?.contains(target) ||
        actionPanelRef.current?.contains(target) ||
        stylePanelRef.current?.contains(target) ||
        aiPanelRef.current?.contains(target)
      ) {
        return;
      }
      setTemplateOpen(false);
      setActionsOpen(false);
      setStyleOpen(false);
      setAiOpen(false);
      setCardColorPickerOpen(false);
      setBackdropColorPickerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [templateOpen, actionsOpen, styleOpen, aiOpen]);

  const insertAtCurrentEdge = useCallback(
    (content: EditorJsonFragment) => {
      const current = hoveredRef.current;
      if (!current || !current.zone) return;
      const insertAt = current.zone === 'top' ? current.pos : current.pos + current.nodeSize;
      editor.chain().focus().insertContentAt(insertAt, content).run();
      setTemplateOpen(false);
    },
    [editor],
  );

  const updateCurrentSectionAttrs = useCallback(
    (attrs: Record<string, unknown>) => {
      const current = hoveredRef.current;
      if (!current) return;
      const sectionPos = findSectionPosById(current.id) ?? current.pos;
      const node = editor.state.doc.nodeAt(sectionPos);
      if (!node || node.type.name !== 'section') return;
      const tr = editor.state.tr.setNodeMarkup(sectionPos, undefined, { ...node.attrs, ...attrs });
      editor.view.dispatch(tr);
      hoveredRef.current = {
        ...current,
        id: typeof node.attrs?.id === 'string' ? node.attrs.id : current.id,
        pos: sectionPos,
        nodeSize: node.nodeSize,
      };
      setTxTick((v) => v + 1);
    },
    [editor, findSectionPosById],
  );

  const duplicateCurrentSection = useCallback(() => {
    const current = hoveredRef.current;
    if (!current) return;
    const node = editor.state.doc.nodeAt(current.pos);
    if (!node) return;
    const tr = editor.state.tr.insert(current.pos + node.nodeSize, node);
    editor.view.dispatch(tr);
    setActionsOpen(false);
  }, [editor]);

  const deleteCurrentSection = useCallback(() => {
    const current = hoveredRef.current;
    if (!current) return;
    const node = editor.state.doc.nodeAt(current.pos);
    if (!node) return;
    const tr = editor.state.tr.delete(current.pos, current.pos + node.nodeSize);
    editor.view.dispatch(tr);
    setActionsOpen(false);
  }, [editor]);

  const onInsertBlank = useCallback(() => {
    insertAtCurrentEdge(createBlankSection());
  }, [insertAtCurrentEdge]);

  const fallbackAiSection = useCallback((prompt: string) => {
    return createBlankSection([
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: prompt.slice(0, 90) || 'Generated section' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Continue editing this AI draft section.' }],
      },
    ]);
  }, []);

  const extractAiSection = useCallback(
    (content: EditorJsonFragment | string): EditorJsonFragment => {
      if (typeof content === 'string') {
        return fallbackAiSection(content);
      }
      if (content.type === 'section') return content;
      return createBlankSection([content]);
    },
    [fallbackAiSection],
  );

  const onInsertAi = useCallback(async () => {
    const prompt = window.prompt('Describe the section to generate:');
    if (!prompt?.trim()) return;

    setAiBusy(true);
    try {
      if (aiConfig?.enabled && aiConfig.endpoint) {
        const res = await callAiEndpoint(aiConfig, {
          action: 'generate-section',
          instructions: prompt.trim(),
          documentContext: editor.getJSON() as EditorJsonDocument,
        });
        insertAtCurrentEdge(extractAiSection(res.content as EditorJsonFragment | string));
      } else {
        insertAtCurrentEdge(fallbackAiSection(prompt.trim()));
      }
    } catch {
      insertAtCurrentEdge(fallbackAiSection(prompt.trim()));
    } finally {
      setAiBusy(false);
    }
  }, [aiConfig, editor, extractAiSection, fallbackAiSection, insertAtCurrentEdge]);

  const controlsStyle = useMemo<React.CSSProperties>(() => {
    if (!hovered || !hovered.zone) return {};
    const top = hovered.zone === 'top' ? hovered.rect.top - 16 : hovered.rect.bottom - 16;
    const left = Math.max(24, Math.min(hovered.rect.left + hovered.rect.width / 2 - 74, window.innerWidth - 180));
    return { top, left };
  }, [hovered]);

  const sectionControlsStyle = useMemo<React.CSSProperties>(() => {
    if (!hovered) return {};
    const top = hovered.rect.top + 8;
    const left = Math.max(8, hovered.rect.left - 8);
    return { top, left };
  }, [hovered]);

  const templateStyle = useMemo<React.CSSProperties>(() => {
    if (!hovered || !hovered.zone) return {};
    const top = hovered.zone === 'top' ? hovered.rect.top - 180 : hovered.rect.bottom + 28;
    const left = Math.max(16, Math.min(hovered.rect.left + hovered.rect.width / 2 - 132, window.innerWidth - 280));
    return { top, left };
  }, [hovered]);
  const sectionPanelStyle = useMemo<React.CSSProperties>(() => {
    if (!hovered) return {};
    return {
      top: hovered.rect.top + 48,
      left: Math.max(8, Math.min(hovered.rect.left + 4, window.innerWidth - 360)),
    };
  }, [hovered]);

  const currentSectionAttrs = useMemo(() => {
    if (!hovered) return null;
    const sectionPos = findSectionPosById(hovered.id) ?? hovered.pos;
    const node = editor.state.doc.nodeAt(sectionPos);
    if (!node) return null;
    return (node.attrs ?? {}) as Record<string, unknown>;
  }, [editor, hovered, txTick, findSectionPosById]);

  const cardWidthValue = (currentSectionAttrs?.cardWidth as string | undefined) ?? 'md';
  const fullBleedValue = currentSectionAttrs?.fullBleed !== false;
  const contentAlignValue = (currentSectionAttrs?.contentAlign as string | undefined) ?? 'top';
  const paddingYValue = (currentSectionAttrs?.paddingY as string | undefined) ?? 'md';
  const cardColorValue = (currentSectionAttrs?.background as { color?: string } | undefined)?.color ?? '';
  const backdropColorValue = (currentSectionAttrs?.backdrop as { color?: string } | undefined)?.color ?? '';

  const themeColors = useMemo(
    () => (Array.isArray(theme?.sectionThemeColors) && theme.sectionThemeColors.length ? theme.sectionThemeColors : DEFAULT_THEME_COLORS),
    [theme?.sectionThemeColors],
  );

  if (!hovered) return null;

  return createPortal(
    <>
      <div ref={sectionControlsRef} className="ae-section-controls" style={sectionControlsStyle}>
        <button
          ref={sectionHandleRef}
          className="ae-section-handle"
          draggable
          onMouseDown={(e) => {
            // Preserve click-to-open panel and drag behavior.
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActionsOpen((v) => !v);
            setStyleOpen(false);
            setAiOpen(false);
            setCardColorPickerOpen(false);
            setBackdropColorPickerOpen(false);
          }}
          onDragStart={(e) => {
            if (!hoveredRef.current) return;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(BLOCK_DRAG_MIME, String(hoveredRef.current.pos));
            e.dataTransfer.setData('text/plain', '');
            const dom = editor.view.nodeDOM(hoveredRef.current.pos);
            if (dom instanceof Element) dom.setAttribute('data-ae-dragging', 'true');
          }}
          onDragEnd={() => {
            if (!hoveredRef.current) return;
            const dom = editor.view.nodeDOM(hoveredRef.current.pos);
            if (dom instanceof Element) dom.removeAttribute('data-ae-dragging');
          }}
          title="Drag section or open section actions"
        >
          <LuEllipsisVertical size={16} />
        </button>

        <button
          className={`ae-section-control-btn${styleOpen ? ' ae-section-control-btn--active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setStyleOpen((v) => !v);
            setAiOpen(false);
            setActionsOpen(false);
            setCardColorPickerOpen(false);
            setBackdropColorPickerOpen(false);
          }}
          title="Section style"
        >
          <LuImage size={15} />
          <LuChevronDown size={13} />
        </button>

        <button
          className={`ae-section-control-btn${aiOpen ? ' ae-section-control-btn--active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setAiOpen((v) => !v);
            setStyleOpen(false);
            setActionsOpen(false);
            setCardColorPickerOpen(false);
            setBackdropColorPickerOpen(false);
          }}
          title="Section AI"
        >
          <LuSparkles size={14} />
          <LuChevronDown size={13} />
        </button>
      </div>

      {hovered.zone && (
        <div ref={controlsRef} className="ae-section-add" style={controlsStyle}>
          <button className="ae-section-add__btn" onMouseDown={(e) => e.preventDefault()} onClick={onInsertBlank} title="Add blank section">
            <LuPlus size={16} />
          </button>
          <button
            className="ae-section-add__btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onInsertAi}
            title="Add section from AI"
            disabled={aiBusy}
          >
            <LuSparkles size={15} />
          </button>
          <button
            className={`ae-section-add__btn${templateOpen ? ' ae-section-add__btn--active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setTemplateOpen((v) => !v)}
            title="Add from template"
          >
            <LuLayoutTemplate size={15} />
          </button>
        </div>
      )}

      {templateOpen && hovered.zone && (
        <div ref={templatesRef} className="ae-section-template-menu" style={templateStyle}>
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              className="ae-section-template-menu__item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertAtCurrentEdge(template.build())}
            >
              <span className="ae-section-template-menu__label">{template.label}</span>
              <span className="ae-section-template-menu__desc">{template.description}</span>
            </button>
          ))}
        </div>
      )}

      {actionsOpen && (
        <div ref={actionPanelRef} className="ae-section-popover ae-section-popover--actions" style={sectionPanelStyle}>
          <button className="ae-section-popover__item" onMouseDown={(e) => e.preventDefault()} onClick={duplicateCurrentSection}>
            <LuCopy size={14} />
            <span>Duplicate section</span>
          </button>
          <button className="ae-section-popover__item ae-section-popover__item--danger" onMouseDown={(e) => e.preventDefault()} onClick={deleteCurrentSection}>
            <LuTrash2 size={14} />
            <span>Delete section</span>
          </button>
        </div>
      )}

      {styleOpen && (
        <div ref={stylePanelRef} className="ae-section-popover ae-section-style-popover" style={sectionPanelStyle}>
          <div className="ae-section-style-popover__row">
            <span>Background image</span>
            <button
              className="ae-section-style-popover__link-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const sectionPos = hoveredRef.current ? findSectionPosById(hoveredRef.current.id) ?? hoveredRef.current.pos : null;
                const current = typeof sectionPos === 'number' ? editor.state.doc.nodeAt(sectionPos) : null;
                const existing = current?.attrs?.background?.imageUrl ?? '';
                const imageUrl = window.prompt('Section background image URL:', existing);
                if (!imageUrl?.trim()) return;
                updateCurrentSectionAttrs({ background: { type: 'image', imageUrl: imageUrl.trim(), opacity: 0.2 } });
              }}
            >
              + Add
            </button>
          </div>

          <div className="ae-section-style-popover__row">
            <span>Card color</span>
            <button
              className="ae-section-style-popover__color-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCardColorPickerOpen((v) => !v)}
            >
              <span className="ae-color-chip" style={{ background: cardColorValue || '#ffffff' }} />
              <span>{cardColorValue || 'Default'}</span>
              <LuChevronDown size={14} />
            </button>
          </div>

          {cardColorPickerOpen && (
            <div className="ae-section-style-popover__picker">
              <div className="ae-section-style-popover__picker-group">
                <span>Theme colors</span>
                <div className="ae-section-swatches ae-section-swatches--grid">
                  {themeColors.map((color) => (
                    <button
                      key={`theme-${color}`}
                      className={`swatch${cardColorValue === color ? ' swatch--active' : ''}`}
                      style={{ background: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateCurrentSectionAttrs({ background: { type: 'color', color } });
                        setCardColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="ae-section-style-popover__picker-group">
                <span>System colors</span>
                <div className="ae-section-swatches ae-section-swatches--grid">
                  {DEFAULT_SYSTEM_COLORS.map((color) => (
                    <button
                      key={`system-${color}`}
                      className={`swatch${cardColorValue === color ? ' swatch--active' : ''}`}
                      style={{ background: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateCurrentSectionAttrs({ background: { type: 'color', color } });
                        setCardColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                className="ae-section-style-popover__reset-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  updateCurrentSectionAttrs({ background: { type: 'none' } });
                  setCardColorPickerOpen(false);
                }}
              >
                Reset to default
              </button>
            </div>
          )}

          <div className="ae-section-style-popover__row">
            <span>Full-bleed card</span>
            <button
              className={`ae-section-toggle${fullBleedValue ? ' ae-section-toggle--on' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => updateCurrentSectionAttrs({ fullBleed: !fullBleedValue })}
            >
              <span />
            </button>
          </div>

          <div className="ae-section-style-popover__row">
            <span>Content alignment</span>
            <div className="ae-section-segmented">
              <button
                className={contentAlignValue === 'top' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ contentAlign: 'top' })}
                title="Top"
              >
                Top
              </button>
              <button
                className={contentAlignValue === 'center' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ contentAlign: 'center' })}
                title="Center"
              >
                Mid
              </button>
              <button
                className={contentAlignValue === 'bottom' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ contentAlign: 'bottom' })}
                title="Bottom"
              >
                Bot
              </button>
            </div>
          </div>

          <div className="ae-section-style-popover__row">
            <span>Card width</span>
            <div className="ae-section-segmented">
              <button
                className={cardWidthValue === 'sm' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ cardWidth: 'sm', variant: 'narrow' })}
              >
                S
              </button>
              <button
                className={cardWidthValue === 'md' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ cardWidth: 'md', variant: 'default' })}
              >
                M
              </button>
              <button
                className={cardWidthValue === 'lg' ? 'is-active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => updateCurrentSectionAttrs({ cardWidth: 'lg', variant: 'wide' })}
              >
                L
              </button>
            </div>
          </div>

          <div className="ae-section-style-popover__row">
            <span>Vertical spacing</span>
            <div className="ae-section-segmented">
              <button className={paddingYValue === 'sm' ? 'is-active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => updateCurrentSectionAttrs({ paddingY: 'sm' })}>S</button>
              <button className={paddingYValue === 'md' ? 'is-active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => updateCurrentSectionAttrs({ paddingY: 'md' })}>M</button>
              <button className={paddingYValue === 'lg' ? 'is-active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => updateCurrentSectionAttrs({ paddingY: 'lg' })}>L</button>
            </div>
          </div>

          <div className="ae-section-style-popover__row">
            <span>Backdrop</span>
            <div className="ae-section-style-popover__row-actions">
              <button
                className="ae-section-style-popover__color-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setBackdropColorPickerOpen((v) => !v)}
              >
                <span className="ae-color-chip" style={{ background: backdropColorValue || '#ffffff' }} />
                <span>{backdropColorValue || 'Default'}</span>
                <LuChevronDown size={14} />
              </button>
              <button
                className="ae-section-style-popover__icon-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const sectionPos = hoveredRef.current ? findSectionPosById(hoveredRef.current.id) ?? hoveredRef.current.pos : null;
                  const current = typeof sectionPos === 'number' ? editor.state.doc.nodeAt(sectionPos) : null;
                  const existing = current?.attrs?.backdrop?.imageUrl ?? '';
                  const imageUrl = window.prompt('Section backdrop image URL:', existing);
                  if (!imageUrl?.trim()) return;
                  updateCurrentSectionAttrs({ backdrop: { type: 'image', imageUrl: imageUrl.trim(), opacity: 0.08 } });
                }}
                title="Backdrop image"
              >
                <LuImage size={14} />
              </button>
            </div>
          </div>

          {backdropColorPickerOpen && (
            <div className="ae-section-style-popover__picker">
              <div className="ae-section-style-popover__picker-group">
                <span>Theme colors</span>
                <div className="ae-section-swatches ae-section-swatches--grid">
                  {themeColors.map((color) => (
                    <button
                      key={`theme-backdrop-${color}`}
                      className={`swatch${backdropColorValue === color ? ' swatch--active' : ''}`}
                      style={{ background: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateCurrentSectionAttrs({ backdrop: { type: 'color', color } });
                        setBackdropColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="ae-section-style-popover__picker-group">
                <span>System colors</span>
                <div className="ae-section-swatches ae-section-swatches--grid">
                  {DEFAULT_SYSTEM_COLORS.map((color) => (
                    <button
                      key={`backdrop-${color}`}
                      className={`swatch${backdropColorValue === color ? ' swatch--active' : ''}`}
                      style={{ background: color }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        updateCurrentSectionAttrs({ backdrop: { type: 'color', color } });
                        setBackdropColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                className="ae-section-style-popover__reset-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  updateCurrentSectionAttrs({ backdrop: { type: 'none' } });
                  setBackdropColorPickerOpen(false);
                }}
              >
                Reset backdrop
              </button>
            </div>
          )}

          <button
            className="ae-section-style-popover__reset-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              updateCurrentSectionAttrs({
                background: { type: 'none' },
                backdrop: { type: 'none' },
                fullBleed: true,
                contentAlign: 'top',
                cardWidth: 'md',
                variant: 'default',
                paddingY: 'md',
              });
              setCardColorPickerOpen(false);
              setBackdropColorPickerOpen(false);
            }}
          >
            Reset styling
          </button>
        </div>
      )}

      {aiOpen && (
        <div ref={aiPanelRef} className="ae-section-popover ae-section-ai-popover" style={sectionPanelStyle}>
          <p>Edit this section with AI</p>
          <div className="ae-section-ai-popover__actions">
            <button onMouseDown={(e) => e.preventDefault()} onClick={onInsertAi} disabled={aiBusy}>
              <LuSparkles size={14} />
              Generate section
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                updateCurrentSectionAttrs({ variant: 'wide' });
                setAiOpen(false);
              }}
            >
              <LuLayoutTemplate size={14} />
              Try new layout
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
