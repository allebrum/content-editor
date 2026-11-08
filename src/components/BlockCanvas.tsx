/**
 * Derived from https://github.com/allebrum/company-portal
 * source path: apps/web/src/components/space/NotesTab.tsx
 * (BlockRow, BlockMenu, CardShell, EditableBlock — product cards omitted)
 * upstream commit: dcea05ee655308385581660b1e38ac6213249791
 * Licensed under the GNU Affero General Public License v3.0.
 * See LICENSE and NOTICE in this repository.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  CheckCircle, CopyPlus, GripVertical, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Pilcrow, Quote, Sparkles, Trash2,
} from 'lucide-react';
import {
  findSlashToken, isEditable, isEmptyContent, isList, matchMarkdownShortcut, pastedLines,
  type MarkdownShortcut,
} from '../blocks';
import { TURN_INTO_OPTIONS } from '../commands';
import {
  caretBox, caretOnFirstLine, caretOnLastLine, getOffsets, needsNormalize,
  readText, setCaret, writeText,
} from '../dom';
import { selectAllEscalates, shiftArrowLeavesBlock } from '../selection';
import type { Block, BlockType } from '../types';
import { Popover } from './Popover';

export type SlashOpen = { rect: { x: number; y: number; top: number }; query: string; tokenStart: number };

export type EditorApi = {
  placeholder: string;
  readOnly: boolean;
  blockCount: number;
  remove: (id: string, opts?: { undo?: boolean; focus?: 'prev' | 'next' | 'none' }) => void;
  duplicate: (id: string) => void;
  turnInto: (id: string, type: BlockType) => void;
  convert: (id: string, patch: Partial<Block>) => void;
  setContent: (id: string, content: string) => void;
  split: (id: string, before: string, after: string) => void;
  mergePrev: (id: string, text: string) => void;
  mergeNext: (id: string, text: string) => boolean;
  markdown: (id: string, md: MarkdownShortcut, text: string) => void;
  pasteLines: (id: string, before: string, lines: string[], after: string) => void;
  pasteFiles: (id: string, files: File[]) => void;
  navigate: (id: string, dir: 'up' | 'down' | 'left' | 'right', x: number) => boolean;
  insertAfter: (id: string) => void;
  openSlash: (id: string, next: SlashOpen | null) => void;
  selectFromEdge: (id: string, dir: 'up' | 'down') => void;
  selectAll: () => void;
  dragStart: (id: string, e: React.DragEvent) => void;
  dragOver: (id: string, e: React.DragEvent) => void;
  drop: (id: string, e: React.DragEvent) => void;
  dragEnd: () => void;
};

function gutterMod(type: BlockType): string {
  return `pe-gutter--${type}`;
}

export function BlockRow({
  block,
  index,
  blocks,
  api,
  slashOpen,
  dropHint,
  selected = false,
}: {
  block: Block;
  index: number;
  blocks: Block[];
  api: EditorApi;
  slashOpen: boolean;
  dropHint: 'before' | 'after' | null;
  selected?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const editable = isEditable(block);

  return (
    <div
      data-row-id={block.id}
      className="pe-row"
      onDragOver={(e) => !api.readOnly && api.dragOver(block.id, e)}
      onDrop={(e) => !api.readOnly && api.drop(block.id, e)}
      data-selected={selected ? 'true' : undefined}
      aria-selected={selected || undefined}
    >
      {selected && <div aria-hidden className="pe-row-sel" />}
      {dropHint === 'before' && <div className="pe-drop pe-drop-before" />}
      {!api.readOnly && (
        <div contentEditable={false} className={`pe-gutter ${gutterMod(block.type)}${menuOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            onClick={() => api.remove(block.id, { undo: true })}
            onMouseDown={(e) => e.preventDefault()}
            title="Delete block"
            aria-label="Delete block"
            className="pe-icon-btn"
          >
            <Trash2 className="pe-icon" />
          </button>
          <div
            ref={handleRef}
            role="button"
            tabIndex={0}
            draggable
            onDragStart={(e) => api.dragStart(block.id, e)}
            onDragEnd={api.dragEnd}
            onClick={() => setMenuOpen((o) => !o)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setMenuOpen((o) => !o);
              }
            }}
            title="Drag to move · click for options"
            aria-label="Block options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="pe-icon-btn pe-handle"
          >
            <GripVertical className="pe-icon" />
          </div>
        </div>
      )}

      {editable ? (
        <EditableBlock block={block} index={index} blocks={blocks} api={api} slashOpen={slashOpen} />
      ) : (
        <DividerShell block={block} api={api} />
      )}

      {dropHint === 'after' && <div className="pe-drop pe-drop-after" />}
      {!api.readOnly && (
        <BlockMenu open={menuOpen} onClose={closeMenu} anchorRef={handleRef} block={block} api={api} />
      )}
    </div>
  );
}

const TURN_INTO_ICONS: Partial<Record<BlockType, React.ComponentType<{ className?: string }>>> = {
  text: Pilcrow, h1: Heading1, h2: Heading2, h3: Heading3,
  bullet: List, numbered: ListOrdered, checkbox: CheckSquare, quote: Quote, callout: Sparkles,
};
const TURN_INTO = TURN_INTO_OPTIONS.map((o) => ({ ...o, icon: TURN_INTO_ICONS[o.type] ?? Pilcrow }));

function BlockMenu({
  open,
  onClose,
  anchorRef,
  block,
  api,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  block: Block;
  api: EditorApi;
}) {
  const item = 'pe-menu-item';
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} width={208}>
      <div role="menu" aria-label="Block options" className="pe-menu">
        <button type="button" role="menuitem" className={`${item} pe-menu-danger`}
          onClick={run(() => api.remove(block.id, { undo: true }))}>
          <Trash2 className="pe-icon" /> Delete
        </button>
        <button type="button" role="menuitem" className={item} onClick={run(() => api.duplicate(block.id))}>
          <CopyPlus className="pe-icon" /> Duplicate
        </button>
        {isEditable(block) && (
          <>
            <div className="pe-menu-label">Turn into</div>
            {TURN_INTO.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                role="menuitemradio"
                aria-checked={block.type === type}
                className={`${item}${block.type === type ? ' is-current' : ''}`}
                onClick={run(() => api.turnInto(block.id, type))}
              >
                <Icon className="pe-icon" /> {label}
              </button>
            ))}
          </>
        )}
      </div>
    </Popover>
  );
}

function DividerShell({ block, api }: { block: Block; api: EditorApi }) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const x = e.currentTarget.getBoundingClientRect().left;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      api.selectAll();
      return;
    }
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      api.selectFromEdge(block.id, e.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        if (api.navigate(block.id, e.key === 'ArrowUp' ? 'up' : 'left', x)) e.preventDefault();
        return;
      case 'ArrowDown':
      case 'ArrowRight':
        if (api.navigate(block.id, e.key === 'ArrowDown' ? 'down' : 'right', x)) e.preventDefault();
        return;
      case 'Backspace':
      case 'Delete':
        if (api.readOnly) return;
        e.preventDefault();
        api.remove(block.id, { undo: true, focus: e.key === 'Delete' ? 'next' : 'prev' });
        return;
      case 'Enter':
        if (api.readOnly) return;
        e.preventDefault();
        api.insertAfter(block.id);
        return;
    }
  };
  return (
    <div
      data-card-id={block.id}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      contentEditable={false}
      className="pe-divider-wrap"
    >
      <hr className="pe-divider" />
    </div>
  );
}

function EditableBlock({
  block,
  index,
  blocks,
  api,
  slashOpen,
}: {
  block: Block;
  index: number;
  blocks: Block[];
  api: EditorApi;
  slashOpen: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const composingRef = useRef(false);
  const dismissedSlashRef = useRef<number | null>(null);
  const wasSlashOpen = useRef(false);
  const content = block.content ?? '';

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || composingRef.current) return;
    if (readText(el, { ignoreTrailingBr: true }) === content && !needsNormalize(el, content)) return;
    const hadFocus = document.activeElement === el;
    const off = hadFocus ? getOffsets(el) : null;
    writeText(el, content);
    if (hadFocus) setCaret(el, Math.min(off?.end ?? content.length, content.length));
  }, [content, block.id, block.type]);

  useEffect(() => {
    if (wasSlashOpen.current && !slashOpen) {
      const el = ref.current;
      if (el) {
        const text = readText(el, { ignoreTrailingBr: true });
        const off = getOffsets(el);
        const tok = findSlashToken(text, off?.end ?? text.length);
        dismissedSlashRef.current = tok ? tok.tokenStart : null;
      }
    }
    wasSlashOpen.current = slashOpen;
  }, [slashOpen]);

  const commit = (el: HTMLDivElement, text: string, caret: number) => {
    if (api.readOnly) return;
    if (block.type === 'text') {
      const md = matchMarkdownShortcut(text, caret);
      if (md) {
        api.openSlash(block.id, null);
        api.markdown(block.id, md, text);
        return;
      }
    }
    if (text !== content) api.setContent(block.id, text);

    const tok = findSlashToken(text, caret);
    if (tok && tok.tokenStart !== dismissedSlashRef.current) {
      const box = caretBox(el);
      api.openSlash(block.id, {
        rect: { x: box.x, y: box.bottom, top: box.top },
        query: tok.query,
        tokenStart: tok.tokenStart,
      });
      return;
    }
    if (!tok) dismissedSlashRef.current = null;
    if (slashOpen) api.openSlash(block.id, null);
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el || composingRef.current || api.readOnly) return;
    const off = getOffsets(el);
    const text = readText(el, { ignoreTrailingBr: true });
    const caret = Math.min(off?.end ?? text.length, text.length);
    if (needsNormalize(el, text)) {
      writeText(el, text);
      setCaret(el, caret);
    }
    commit(el, text, caret);
  };

  const insertAtCaret = (insert: string) => {
    const el = ref.current;
    if (!el) return;
    const text = readText(el, { ignoreTrailingBr: true });
    const off = getOffsets(el) ?? { start: text.length, end: text.length };
    const next = text.slice(0, off.start) + insert + text.slice(off.end);
    const caret = off.start + insert.length;
    writeText(el, next);
    setCaret(el, caret);
    commit(el, next, caret);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229 || composingRef.current) return;
    if (slashOpen && ['Enter', 'ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) {
      e.preventDefault();
      return;
    }
    const el = ref.current;
    if (!el) return;
    const text = readText(el, { ignoreTrailingBr: true });
    const off = getOffsets(el) ?? { start: text.length, end: text.length };
    const collapsed = off.start === off.end;
    const mod = e.metaKey || e.ctrlKey || e.altKey;

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a') {
      if (selectAllEscalates(text.length, off.start, off.end)) {
        e.preventDefault();
        api.selectAll();
      }
      return;
    }
    if (e.shiftKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const dir = e.key === 'ArrowUp' ? 'up' : 'down';
      if (shiftArrowLeavesBlock(dir, text.length, off.start, off.end)) {
        e.preventDefault();
        api.selectFromEdge(block.id, dir);
      }
      return;
    }

    if (api.readOnly) return;

    switch (e.key) {
      case 'Enter': {
        e.preventDefault();
        if (e.shiftKey) {
          insertAtCaret('\n');
          return;
        }
        if (isEmptyContent(text) && isList(block.type)) {
          api.turnInto(block.id, 'text');
          return;
        }
        api.split(block.id, text.slice(0, off.start), text.slice(off.end));
        return;
      }
      case 'Backspace': {
        if (!collapsed || off.start !== 0 || mod) return;
        e.preventDefault();
        if (block.type !== 'text') {
          api.turnInto(block.id, 'text');
          return;
        }
        if (isEmptyContent(text)) {
          if (blocks.length <= 1) return;
          api.remove(block.id, { focus: index === 0 ? 'next' : 'prev' });
          return;
        }
        if (index > 0) api.mergePrev(block.id, text);
        return;
      }
      case 'Delete': {
        if (!collapsed || off.end !== text.length || mod) return;
        if (api.mergeNext(block.id, text)) e.preventDefault();
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        if (e.shiftKey || mod || !collapsed) return;
        const up = e.key === 'ArrowUp';
        if (up ? !caretOnFirstLine(el) : !caretOnLastLine(el)) return;
        if (api.navigate(block.id, up ? 'up' : 'down', caretBox(el).x)) e.preventDefault();
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (e.shiftKey || mod || !collapsed) return;
        const left = e.key === 'ArrowLeft';
        if (left ? off.start !== 0 : off.end !== text.length) return;
        if (api.navigate(block.id, left ? 'left' : 'right', 0)) e.preventDefault();
        return;
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (api.readOnly) {
      e.preventDefault();
      return;
    }
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      api.pasteFiles(block.id, files);
      return;
    }
    e.preventDefault();
    const raw = e.clipboardData.getData('text/plain');
    if (!raw) return;
    const lines = pastedLines(raw);
    if (lines.length <= 1 || block.type === 'quote' || block.type === 'callout') {
      insertAtCaret(lines.length <= 1 ? (lines[0] ?? '') : lines.join('\n'));
      return;
    }
    const el = ref.current;
    if (!el) return;
    const text = readText(el, { ignoreTrailingBr: true });
    const off = getOffsets(el) ?? { start: text.length, end: text.length };
    api.openSlash(block.id, null);
    api.pasteLines(block.id, text.slice(0, off.start), lines, text.slice(off.end));
  };

  const prefix = (() => {
    if (block.type === 'bullet') return <span className="pe-prefix pe-bullet" contentEditable={false}>•</span>;
    if (block.type === 'numbered') {
      let n = 1;
      for (let i = index - 1; i >= 0; i--) {
        if (blocks[i]!.type === 'numbered') n++;
        else break;
      }
      return <span className="pe-prefix pe-num" contentEditable={false}>{n}.</span>;
    }
    if (block.type === 'checkbox') {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!api.readOnly) api.convert(block.id, { checked: !block.checked });
          }}
          className="pe-check"
          aria-label={block.checked ? 'Uncheck' : 'Check'}
          aria-pressed={!!block.checked}
          disabled={api.readOnly}
          onMouseDown={(e) => e.preventDefault()}
        >
          {block.checked && <CheckCircle className="pe-icon" />}
        </button>
      );
    }
    return null;
  })();

  return (
    <div className="pe-line">
      {prefix}
      <div
        ref={ref}
        contentEditable={!api.readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-readonly={api.readOnly || undefined}
        aria-label={placeholderFor(block, true, api.placeholder) || 'Text'}
        data-block-id={block.id}
        data-empty={isEmptyContent(content) ? 'true' : 'false'}
        data-placeholder={placeholderFor(block, focused, api.placeholder)}
        data-testid={`block-${block.id}`}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCompositionStart={() => {
          composingRef.current = true;
          if (ref.current) ref.current.dataset.empty = 'false';
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          handleInput();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (slashOpen) api.openSlash(block.id, null);
        }}
        className={`pe-text pe-text-${block.type}${block.type === 'checkbox' && block.checked ? ' is-checked' : ''}`}
      />
    </div>
  );
}

function placeholderFor(block: Block, focused: boolean, fallback: string): string {
  switch (block.type) {
    case 'h1': return 'Heading 1';
    case 'h2': return 'Heading 2';
    case 'h3': return 'Heading 3';
    case 'quote': return 'Quote';
    case 'callout': return 'Tip or callout';
    case 'bullet': return 'List item';
    case 'numbered': return 'List item';
    case 'checkbox': return 'Task';
    default: return focused ? (fallback || "Press '/' for commands") : fallback;
  }
}
