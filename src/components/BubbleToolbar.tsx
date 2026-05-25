import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BubbleMenu } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { AiConfig } from '../schema/types';
import { renderVizTemplate } from '../utils/vizTemplates/index';
import type { VizData } from '../utils/vizTemplates/types';
import {
  LuBold, LuItalic, LuUnderline, LuStrikethrough, LuCode, LuRemoveFormatting,
  LuLink, LuList, LuListOrdered,
  LuAlignLeft, LuAlignCenter, LuAlignRight, LuAlignJustify,
  LuCheck, LuX, LuChevronDown, LuSparkles,
  LuWand, LuMinimize2, LuMaximize2, LuSpellCheck, LuClipboardList, LuZap, LuImage,
} from 'react-icons/lu';

// ── useDropdown: manages open/close with outside-click + fixed portal coords ──
interface DropdownState {
  open: boolean;
  coords: { top: number; left: number };
}

function useDropdown() {
  const [state, setState] = useState<DropdownState>({ open: false, coords: { top: 0, left: 0 } });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inMenu = menuRef.current?.contains(target);
      if (!inTrigger && !inMenu) setState(s => ({ ...s, open: false }));
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [state.open]);

  const toggle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setState(s => ({
      open: !s.open,
      coords: { top: rect.bottom + 6, left: rect.left },
    }));
  }, []);

  const close = useCallback(() => setState(s => ({ ...s, open: false })), []);

  return { open: state.open, coords: state.coords, triggerRef, menuRef, toggle, close };
}

// ── Text style options ─────────────────────────────────────────────────────────
type TextStyleValue = 'normal' | 'h1' | 'h2' | 'h3' | 'h4';

const TEXT_STYLES: { value: TextStyleValue; label: string; labelClass: string; hint: string }[] = [
  { value: 'normal', label: 'Normal',    labelClass: 'ae-tb-style-label--normal', hint: 'Paragraph' },
  { value: 'h1',     label: 'Heading 1', labelClass: 'ae-tb-style-label--h1',     hint: 'Large title' },
  { value: 'h2',     label: 'Heading 2', labelClass: 'ae-tb-style-label--h2',     hint: 'Section title' },
  { value: 'h3',     label: 'Heading 3', labelClass: 'ae-tb-style-label--h3',     hint: 'Subsection' },
  { value: 'h4',     label: 'Heading 4', labelClass: 'ae-tb-style-label--h4',     hint: 'Small heading' },
];

function getActiveStyle(editor: Editor): TextStyleValue {
  if (editor.isActive('heading', { level: 1 })) return 'h1';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('heading', { level: 4 })) return 'h4';
  return 'normal';
}

// ── Alignment options ──────────────────────────────────────────────────────────
const ALIGN_OPTIONS = [
  { value: 'left',    icon: LuAlignLeft,    label: 'Left' },
  { value: 'center',  icon: LuAlignCenter,  label: 'Center' },
  { value: 'right',   icon: LuAlignRight,   label: 'Right' },
  { value: 'justify', icon: LuAlignJustify, label: 'Justify' },
];

// ── AI rewrite options ─────────────────────────────────────────────────────────
const AI_REWRITE_OPTIONS = [
  { value: 'improve-writing', icon: LuWand,          label: 'Improve writing' },
  { value: 'make-shorter',    icon: LuMinimize2,      label: 'Make shorter' },
  { value: 'make-longer',     icon: LuMaximize2,      label: 'Make longer' },
  { value: 'fix-grammar',     icon: LuSpellCheck,     label: 'Fix grammar' },
  { value: 'summarize',       icon: LuClipboardList,  label: 'Summarize' },
  { value: 'simplify',        icon: LuZap,            label: 'Simplify language' },
];

// ── Visualization types ────────────────────────────────────────────────────────
export const VISUALIZATION_TYPES: { value: string; label: string; icon: string; description: string }[] = [
  { value: 'arrow-bars',            icon: '▶',  label: 'Arrow bars',            description: 'Horizontal bars with arrow tips, each bar labeled with a title and value' },
  { value: 'bubbles',               icon: '⬤',  label: 'Bubbles',               description: 'Clustered circles of varying sizes, each with text content inside' },
  { value: 'bullseye',              icon: '◎',  label: 'Bullseye',              description: 'Concentric rings/target with labels on each ring from outermost to center' },
  { value: 'chain',                 icon: '⛓',  label: 'Chain',                 description: 'Sequential items connected by chain links or rings, flowing left to right' },
  { value: 'concentric-circles',    icon: '◎',  label: 'Concentric circles',    description: 'Multiple concentric circles radiating from center, each ring labeled' },
  { value: 'connected-circles',     icon: '⊙',  label: 'Connected circles',     description: 'Circles connected by lines showing relationships between concepts' },
  { value: 'diamonds',              icon: '◆',  label: 'Diamonds',              description: 'Multiple diamond shapes arranged in a row or grid, each with text inside' },
  { value: 'funnel-3d',             icon: '▽',  label: 'Funnel 3D',             description: '3D funnel shape with 3-5 horizontal sections narrowing toward the bottom' },
  { value: 'gears',                 icon: '⚙',  label: 'Gears',                 description: 'Interlocking gear shapes, each gear containing a concept or label' },
  { value: 'hot-air-balloons',      icon: '🎈', label: 'Hot air balloons',      description: 'Multiple hot air balloons at different heights with labels in the baskets' },
  { value: 'iceberg',               icon: '◢',  label: 'Iceberg',               description: 'Iceberg with items above the waterline (visible) and below (hidden/deep)' },
  { value: 'ideas',                 icon: '💡', label: 'Ideas',                 description: 'Light bulb or thought-bubble style with ideas branching outward from center' },
  { value: 'infinity',              icon: '∞',  label: 'Infinity',              description: 'Figure-8 infinity loop with content in each lobe showing two connected concepts' },
  { value: 'inputs',                icon: '⇒',  label: 'Inputs',                description: 'Multiple arrows converging into a central box (inputs → process → output)' },
  { value: 'isometric-building',    icon: '🏢', label: 'Isometric building',    description: 'Isometric view of a multi-floor building with labeled floors or sections' },
  { value: 'isometric-squares',     icon: '⬡',  label: 'Isometric squares',     description: 'Isometric grid of dashed squares forming a 3D perspective grid layout' },
  { value: 'isometric-globe',       icon: '🌐', label: 'Isometric globe',       description: 'Globe rendered in isometric perspective with labeled regions' },
  { value: 'linear-venn',           icon: '⊂⊃', label: 'Linear venn',           description: 'Overlapping circles arranged in a horizontal line with shared intersections labeled' },
  { value: 'linear-venn-filled',    icon: '⬤⬤', label: 'Linear venn filled',    description: 'Same as linear venn but with solid filled color circles' },
  { value: 'minimal-funnel',        icon: '▽',  label: 'Minimal funnel',        description: 'Clean flat funnel with stacked horizontal sections narrowing downward' },
  { value: 'minimal-road',          icon: '⊸',  label: 'Minimal road',          description: 'Clean straight road with milestone markers along the path' },
  { value: 'nested-diamond',        icon: '◆',  label: 'Nested diamond',        description: 'Diamond shapes nested inside each other with labels at each level' },
  { value: 'orbit',                 icon: '⊚',  label: 'Orbit',                 description: 'Central concept circle with smaller circles orbiting around it on elliptical paths' },
  { value: 'packed-circles',        icon: '⬤',  label: 'Packed circles',        description: 'Many circles packed tightly in a rectangular space, varying sizes' },
  { value: 'pillar',                icon: '|',  label: 'Pillar',                description: 'Multiple vertical pillars/columns of different heights, each labeled at the base' },
  { value: 'pinwheel',              icon: '✳',  label: 'Pinwheel',              description: 'Wedge-shaped sections arranged around a central point like a pinwheel or pie' },
  { value: 'puzzle',                icon: '🧩', label: 'Puzzle',                description: 'Interlocking puzzle pieces arranged together, text in each piece' },
  { value: 'quadrant',              icon: '⊞',  label: 'Quadrant',              description: '2×2 matrix grid with four labeled quadrants on X and Y axes' },
  { value: 'ribbon-arrows',         icon: '↷',  label: 'Ribbon arrows',         description: 'Curved ribbon-style arrows flowing left to right showing a process or timeline' },
  { value: 'road',                  icon: '⊸',  label: 'Road',                  description: 'Winding road stretching into the distance with milestones marked along the path' },
  { value: 'semi-circle-road',      icon: '⌓',  label: 'Semi circle road',      description: 'Road that follows a semi-circular arc with stops along the curve' },
  { value: 'signs',                 icon: '⬆',  label: 'Signs',                 description: 'Street sign posts with multiple directional signs pointing different ways' },
  { value: 'slope',                 icon: '/',  label: 'Slope',                 description: 'Ascending mountain/slope with markers at different elevation levels' },
  { value: 'solar-system',          icon: '☀',  label: 'Solar system',          description: 'Central sun/core with multiple elements orbiting at different distances' },
  { value: 'square-arrows',         icon: '⇄',  label: 'Square arrows',         description: 'Square shapes connected by directional arrows showing flow or relationships' },
  { value: 'swoosh',                icon: '↗',  label: 'Swoosh',                description: 'Bold curved swoosh or arch shapes with text labels flowing through them' },
  { value: 'target',                icon: '🎯', label: 'Target',                description: 'Concentric target circles for prioritization from outermost to bullseye center' },
  { value: 'venn-diagram',          icon: '⊂⊃', label: 'Venn diagram',          description: 'Two or three overlapping circles with unique and shared content labeled' },
  { value: 'versus',                icon: 'VS', label: 'Versus',                description: 'Two sides facing each other with VS in the middle, showing comparison' },
];

// ── TextStyleDropdown ──────────────────────────────────────────────────────────
function TextStyleDropdown({ editor }: { editor: Editor }) {
  const { open, coords, triggerRef, menuRef, toggle, close } = useDropdown();
  const active = getActiveStyle(editor);
  const activeLabel = TEXT_STYLES.find(s => s.value === active)?.label ?? 'Normal';

  function applyStyle(value: TextStyleValue) {
    if (value === 'normal') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.slice(1)) as 1 | 2 | 3 | 4;
      editor.chain().focus().toggleHeading({ level }).run();
    }
    close();
  }

  return (
    <div className="ae-tb-dropdown">
      <button
        ref={triggerRef}
        className="ae-tb-trigger"
        onMouseDown={e => { e.preventDefault(); toggle(); }}
        aria-expanded={open}
        aria-label="Text style"
      >
        {activeLabel}
        <span className="ae-tb-trigger-chevron">▾</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="ae-tb-menu ae-tb-style-menu"
          role="menu"
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 99999 }}
        >
          {TEXT_STYLES.map(style => (
            <button
              key={style.value}
              className={`ae-tb-menu-item${active === style.value ? ' ae-tb-menu-item--active' : ''}`}
              onMouseDown={e => { e.preventDefault(); applyStyle(style.value); }}
              role="menuitem"
            >
              <span className={`ae-tb-style-label ${style.labelClass}`}>{style.label}</span>
              <span className="ae-tb-style-hint">{style.hint}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── AlignDropdown ──────────────────────────────────────────────────────────────
function AlignDropdown({ editor }: { editor: Editor }) {
  const { open, coords, triggerRef, menuRef, toggle, close } = useDropdown();
  const activeOpt = ALIGN_OPTIONS.find(a => editor.isActive({ textAlign: a.value })) ?? ALIGN_OPTIONS[0];

  return (
    <div className="ae-tb-dropdown">
      <button
        ref={triggerRef}
        className="ae-tb-trigger"
        onMouseDown={e => { e.preventDefault(); toggle(); }}
        aria-expanded={open}
        aria-label="Text alignment"
        title="Alignment"
      >
        <activeOpt.icon />
        <span className="ae-tb-trigger-chevron"><LuChevronDown size={12} /></span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="ae-tb-menu"
          role="menu"
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 99999 }}
        >
          {ALIGN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ae-tb-menu-item${editor.isActive({ textAlign: opt.value }) ? ' ae-tb-menu-item--active' : ''}`}
              onMouseDown={e => {
                e.preventDefault();
                editor.chain().focus().setTextAlign(opt.value).run();
                close();
              }}
              role="menuitem"
            >
              <span className="ae-tb-ai-icon"><opt.icon /></span>
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── AiDropdown — rewrite actions + Visualize type picker ──────────────────────
interface AiDropdownProps {
  editor: Editor;
  aiConfig: AiConfig;
  savedSelection: React.RefObject<{ from: number; to: number; text: string }>;
}



function AiDropdown({ editor, aiConfig, savedSelection }: AiDropdownProps) {
  const { open, coords, triggerRef, menuRef, toggle, close } = useDropdown();
  const [loading, setLoading] = useState(false);

  // Reset on close handled implicitly (no sub-views anymore)

  const fireAi = useCallback(async (action: string, visualizationType?: string) => {
    if (!aiConfig?.endpoint) return;
    const { from, to, text } = savedSelection.current!;
    if (!text.trim()) return;
    close();
    setLoading(true);

    const body: Record<string, unknown> = {
      action,
      selection: { text, from, to },
    };
    if (visualizationType) body.instructions = visualizationType;

    try {
      const res = await fetch(aiConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(aiConfig.headers ?? {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.type === 'replace-selection' && typeof data.content === 'string') {
        editor.chain().focus().deleteRange({ from, to }).insertContent(data.content).run();
      } else if (data.type === 'viz-data') {
        // Template-based: AI returns structured JSON, we render the SVG
        const vizType = (data.vizType as string) ?? visualizationType ?? 'ideas';
        const vizDataObj = data.data as VizData;
        const svgContent = renderVizTemplate(vizType, vizDataObj);
        (editor.chain().focus() as any)
          .insertContentAt(to, {
            type: 'svgGraphic',
            attrs: {
              id: `svg-${Date.now()}`,
              svgContent,
              vizData: JSON.stringify(vizDataObj),
              prompt: text,
              visualizationType: vizType,
              generatedBy: 'ai',
              createdAt: new Date().toISOString(),
            },
          })
          .run();
      } else if (data.type === 'insert-block') {
        const svgContent = typeof data.content === 'string'
          ? data.content
          : (data.content?.attrs?.svgContent as string | undefined);
        if (svgContent) {
          (editor.chain().focus() as any)
            .insertContentAt(to, {
              type: 'svgGraphic',
              attrs: {
                id: `svg-${Date.now()}`,
                svgContent,
                prompt: text,
                visualizationType: visualizationType ?? 'ideas',
                generatedBy: 'ai',
                createdAt: new Date().toISOString(),
              },
            })
            .run();
        }
      }
    } catch {
      // Silently fail — host app handles AI errors
    } finally {
      setLoading(false);
    }
  }, [editor, aiConfig, savedSelection, close]);

  return (
    <div className="ae-tb-dropdown">
      <button
        ref={triggerRef}
        className="ae-tb-trigger"
        onMouseDown={e => { e.preventDefault(); if (!loading) toggle(); }}
        aria-expanded={open}
        aria-label="AI tools"
        title="AI tools"
        disabled={loading}
      >
        {loading ? <span className="ae-tb-spinner-sm" /> : <LuSparkles size={14} />}
        <span style={{ marginLeft: 3 }}>AI</span>
        <span className="ae-tb-trigger-chevron"><LuChevronDown size={12} /></span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="ae-tb-menu"
          role="menu"
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 99999 }}
        >
          {AI_REWRITE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className="ae-tb-menu-item"
              onMouseDown={e => { e.preventDefault(); fireAi(opt.value); }}
              role="menuitem"
            >
              <span className="ae-tb-ai-icon"><opt.icon /></span>
              {opt.label}
            </button>
          ))}
          <div className="ae-tb-menu-sep" />
          <button
            className="ae-tb-menu-item ae-tb-menu-item--visualize"
            onMouseDown={e => { e.preventDefault(); fireAi('generate-svg-graphic', 'ideas'); }}
            role="menuitem"
          >
            <span className="ae-tb-ai-icon"><LuImage size={14} /></span>
            Visualize
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Main BubbleToolbar ─────────────────────────────────────────────────────────
interface BubbleToolbarProps {
  editor: Editor;
  aiConfig?: AiConfig | undefined;
}

export function BubbleToolbar({ editor, aiConfig }: BubbleToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);

  // ── Persist selection so portaled menus don't lose it on mousedown ──────────
  const savedSelectionRef = useRef<{ from: number; to: number; text: string }>({ from: 0, to: 0, text: '' });

  // Snapshot at render time — catches the initial selection that showed the BubbleMenu
  // (selectionUpdate fires before the component mounts, so useEffect alone misses it)
  const _rSel = editor.state.selection;
  const _rText = editor.state.doc.textBetween(_rSel.from, _rSel.to, '\n').trim();
  if (_rText) savedSelectionRef.current = { from: _rSel.from, to: _rSel.to, text: _rText };

  useEffect(() => {
    const save = () => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n').trim();
      if (text) savedSelectionRef.current = { from, to, text };
    };
    editor.on('selectionUpdate', save);
    return () => { editor.off('selectionUpdate', save); };
  }, [editor]);

  useEffect(() => {
    if (showLinkInput) linkInputRef.current?.focus();
  }, [showLinkInput]);

  const applyLink = useCallback(() => {
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl.trim(), target: '_blank' }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const hasAi = aiConfig?.enabled && !!aiConfig.endpoint;

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: 'top', maxWidth: 'none' }}
      className="ae-bubble-toolbar"
    >
      {showLinkInput ? (
        /* ── Link input row ── */
        <span className="ae-tb-link-row">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') applyLink();
              if (e.key === 'Escape') { setShowLinkInput(false); setLinkUrl(''); }
            }}
            placeholder="https://..."
            aria-label="Link URL"
            className="ae-tb-link-input"
          />
          <button
            className="ae-tb-btn"
            onMouseDown={e => { e.preventDefault(); applyLink(); }}
            aria-label="Apply link"
            title="Apply"
          ><LuCheck size={14} /></button>
          <button
            className="ae-tb-btn"
            onMouseDown={e => { e.preventDefault(); setShowLinkInput(false); setLinkUrl(''); }}
            aria-label="Cancel"
            title="Cancel"
          ><LuX size={14} /></button>
        </span>
      ) : (
        <>
          {/* ── Text style dropdown ── */}
          <TextStyleDropdown editor={editor} />

          <span className="ae-tb-sep" aria-hidden="true" />

          {/* ── Core inline formatting ── */}
          <button
            className={`ae-tb-btn${editor.isActive('bold') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            aria-label="Bold" aria-pressed={editor.isActive('bold')}
          ><LuBold size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('italic') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            aria-label="Italic" aria-pressed={editor.isActive('italic')}
          ><LuItalic size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('underline') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
            aria-label="Underline" aria-pressed={editor.isActive('underline')}
          ><LuUnderline size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('strike') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
            aria-label="Strikethrough" aria-pressed={editor.isActive('strike')}
          ><LuStrikethrough size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('code') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
            aria-label="Inline code" aria-pressed={editor.isActive('code')}
            title="Code"
          ><LuCode size={14} /></button>

          <button
            className="ae-tb-btn"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetAllMarks().run(); }}
            aria-label="Clear formatting"
            title="Clear formatting"
          ><LuRemoveFormatting size={14} /></button>
          <button
            className={`ae-tb-btn${editor.isActive('link') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setLinkUrl(editor.getAttributes('link').href ?? '');
                setShowLinkInput(true);
              }
            }}
            aria-label="Link" aria-pressed={editor.isActive('link')}
            title="Link"
          ><LuLink size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('bulletList') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            aria-label="Bullet list" aria-pressed={editor.isActive('bulletList')}
            title="Bullet list"
          ><LuList size={14} /></button>

          <button
            className={`ae-tb-btn${editor.isActive('orderedList') ? ' ae-tb-btn--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            aria-label="Ordered list" aria-pressed={editor.isActive('orderedList')}
            title="Ordered list"
          ><LuListOrdered size={14} /></button>

          <span className="ae-tb-sep" aria-hidden="true" />

          {/* ── Alignment dropdown ── */}
          <AlignDropdown editor={editor} />

          {/* ── AI dropdown (rewrite + visualize) ── */}
          {hasAi && (
            <>
              <span className="ae-tb-sep" aria-hidden="true" />
              <AiDropdown editor={editor} aiConfig={aiConfig!} savedSelection={savedSelectionRef} />
            </>
          )}
        </>
      )}
    </BubbleMenu>
  );
}
