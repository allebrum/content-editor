/**
 * Host-facing Hoppa-style block editor. Canvas behavior is derived from
 * allebrum/company-portal NotesTab (dcea05ee655308385581660b1e38ac6213249791)
 * without product stores, sockets, uploads, or auth.
 * Licensed under AGPL-3.0. See LICENSE and NOTICE.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  blockId, emptyText, isEditable, reducer,
} from '../blocks';
import { extraCommandsFromAdapters, SLASH_COMMANDS, type CommandDef } from '../commands';
import { placeCaretNearX, setCaret } from '../dom';
import {
  markdownPlan, mergeNextPlan, mergePrevPlan, pasteLinesPlan, slashPickPlan, splitBlockPlan,
} from '../editing';
import { documentsEqual, emptyDocument, parseDocument } from '../schema';
import type { Block, EditorDocument, ExtraSlashCommand, HostAdapters } from '../types';
import { DocumentParseError } from '../errors';
import { BlockRow, type EditorApi, type SlashOpen } from './BlockCanvas';
import { ShortcutsHelp } from './ShortcutsHelp';
import { SlashMenu } from './SlashMenu';
import { useBlockSelection } from './useBlockSelection';

const DRAG_MIME = 'application/x-page-editor-block';

type CaretPos = 'start' | 'end' | number;

export type BlockEditorProps = {
  value?: EditorDocument | null;
  onChange?: (next: EditorDocument) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  adapters?: HostAdapters;
  extraCommands?: ExtraSlashCommand[];
  className?: string;
  /** Shown when `value` cannot be parsed. The previous valid document is kept on screen. */
  onParseError?: (error: DocumentParseError) => void;
};

function cssId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/["\\]/g, '\\$&');
}

function editorEl(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-block-id="${cssId(id)}"]`);
}

function focusBlock(id: string, pos: CaretPos = 'end'): boolean {
  const el = editorEl(id);
  if (el) {
    el.focus({ preventScroll: true });
    setCaret(el, pos === 'start' ? 0 : pos === 'end' ? Infinity : pos);
    el.scrollIntoView?.({ block: 'nearest' });
    return true;
  }
  const card = document.querySelector<HTMLElement>(`[data-card-id="${cssId(id)}"]`);
  if (card) {
    card.focus({ preventScroll: true });
    card.scrollIntoView?.({ block: 'nearest' });
    return true;
  }
  return false;
}

function dispatchAll(dispatch: React.Dispatch<import('../blocks').Action>, actions: import('../blocks').Action[]) {
  for (const a of actions) dispatch(a);
}

export function BlockEditor({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  placeholder = "Press '/' for commands",
  adapters,
  extraCommands,
  className,
  onParseError,
}: BlockEditorProps) {
  const locked = readOnly || disabled;
  const [blocks, dispatch] = useReducer(reducer, emptyDocument().blocks);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const pendingFocusRef = useRef<{ id: string; pos: CaretPos } | null>(null);
  const skipEmitRef = useRef(true);
  const [slash, setSlash] = useState<(SlashOpen & { blockId: string }) | null>(null);
  const [notice, setNotice] = useState<{ label: string; undo: () => void } | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<EditorDocument | null>(null);

  useEffect(() => {
    if (value == null) {
      if (blocksRef.current.length === 1 && blocksRef.current[0] && isEditable(blocksRef.current[0]) && !(blocksRef.current[0].content)) {
        return;
      }
      skipEmitRef.current = true;
      dispatch({ type: 'replace', blocks: emptyDocument().blocks });
      return;
    }
    try {
      const parsed = parseDocument(value);
      if (lastEmitted.current && documentsEqual(parsed, lastEmitted.current)) return;
      if (documentsEqual(parsed, { version: 1, blocks: blocksRef.current })) return;
      skipEmitRef.current = true;
      dispatch({ type: 'replace', blocks: parsed.blocks });
    } catch (err) {
      if (err instanceof DocumentParseError) onParseError?.(err);
    }
  }, [value, onParseError]);

  useEffect(() => {
    if (skipEmitRef.current) {
      skipEmitRef.current = false;
      lastEmitted.current = { version: 1, blocks };
      return;
    }
    const next: EditorDocument = { version: 1, blocks };
    lastEmitted.current = next;
    onChange?.(next);
  }, [blocks, onChange]);

  const focusAfterRender = (id: string, pos: CaretPos = 'end') => {
    const req = { id, pos };
    pendingFocusRef.current = req;
    requestAnimationFrame(() => {
      if (pendingFocusRef.current !== req) return;
      pendingFocusRef.current = null;
      focusBlock(id, pos);
    });
  };

  const notify = (label: string, undo: () => void) => {
    setNotice({ label, undo });
    window.setTimeout(() => setNotice((n) => (n?.label === label ? null : n)), 6000);
  };

  const blockSel = useBlockSelection({
    blocks,
    blocksRef,
    dispatch,
    focusAfterRender,
    canvasRef,
    notify: locked ? undefined : notify,
  });

  const insertAfter = (afterId: string | null, b?: Partial<Block>) => {
    const block: Block = { id: blockId(), type: 'text', content: '', ...b };
    dispatch({ type: 'insert', after: afterId, block });
    focusAfterRender(block.id, 'end');
    return block.id;
  };

  const restoreBlock = (block: Block, prevId: string | null) => {
    const list = blocksRef.current;
    if (list.some((x) => x.id === block.id)) return;
    const anchor = prevId && list.some((x) => x.id === prevId) ? prevId : null;
    dispatch({ type: 'insert', after: anchor, block });
    focusAfterRender(block.id, 'end');
  };

  const removeBlock = (id: string, opts: { undo?: boolean; focus?: 'prev' | 'next' | 'none' } = {}) => {
    const list = blocksRef.current;
    const idx = list.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const removed = list[idx]!;
    const prev = list[idx - 1] ?? null;
    const next = list[idx + 1] ?? null;
    if (slash?.blockId === id) setSlash(null);
    if (list.length <= 1) {
      const fresh = emptyText();
      dispatch({ type: 'replace', blocks: [fresh] });
      focusAfterRender(fresh.id, 'end');
    } else {
      dispatch({ type: 'remove', id });
      const target = opts.focus === 'next' ? (next ?? prev) : (prev ?? next);
      if (opts.focus !== 'none' && target) {
        focusAfterRender(target.id, target === next ? 'start' : 'end');
      }
    }
    const trivial = isEditable(removed) && !(removed.content ?? '').replace(/\u200B/g, '');
    if (opts.undo && !trivial) {
      notify('Block deleted', () => restoreBlock(removed, prev?.id ?? null));
    }
  };

  const runPlan = (plan: ReturnType<typeof splitBlockPlan>) => {
    dispatchAll(dispatch, plan.actions);
    if (plan.focus) focusAfterRender(plan.focus.id, plan.focus.pos);
    return plan;
  };

  const onPickSlash = (cmd: string) => {
    const s = slash;
    if (!s) return;
    setSlash(null);
    const hostExtra = extraCommands?.find((c) => c.id === cmd);
    const plan = slashPickPlan(blocksRef.current, s.blockId, s.tokenStart, s.query, cmd);
    runPlan(plan);
    if (plan.host) {
      if (plan.host.kind === 'mention') adapters?.mention?.({ blockId: plan.host.blockId, caret: plan.host.caret, query: '' });
      if (plan.host.kind === 'upload') {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.style.display = 'none';
        input.addEventListener('change', () => {
          const files = Array.from(input.files ?? []);
          if (files.length) void adapters?.upload?.(files, { blockId: plan.host!.blockId });
          input.remove();
        });
        document.body.appendChild(input);
        input.click();
      }
      if (plan.host.kind === 'embed') adapters?.embed?.({ blockId: plan.host.blockId });
    }
    if (hostExtra) {
      const target = blocksRef.current.find((b) => b.id === s.blockId);
      hostExtra.run({ blockId: s.blockId, content: target?.content ?? '', caret: plan.focus && typeof plan.focus.pos === 'number' ? plan.focus.pos : 0 });
    }
  };

  const onDragStartBlock = (id: string, e: React.DragEvent) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DRAG_MIME, id);
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-row-id]');
    if (row) e.dataTransfer.setDragImage(row, 16, 12);
    setSlash(null);
  };
  const onDragOverBlock = (id: string, e: React.DragEvent) => {
    if (!dragIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'before' | 'after' = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    setDropHint((prev) => (prev?.id === id && prev.pos === pos ? prev : { id, pos }));
  };
  const onDropBlock = (id: string, e: React.DragEvent) => {
    const dragged = dragIdRef.current;
    if (!dragged) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'before' | 'after' = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
    if (dragged !== id) dispatch({ type: 'move', id: dragged, target: id, position: pos });
    dragIdRef.current = null;
    setDropHint(null);
  };

  const navigate = (id: string, dir: 'up' | 'down' | 'left' | 'right', x: number): boolean => {
    const list = blocksRef.current;
    const idx = list.findIndex((b) => b.id === id);
    const target = list[idx + (dir === 'up' || dir === 'left' ? -1 : 1)];
    if (idx === -1 || !target) return false;
    if (!isEditable(target)) return focusBlock(target.id);
    const el = editorEl(target.id);
    if (!el) return false;
    if (dir === 'up' || dir === 'down') {
      placeCaretNearX(el, x, dir === 'up' ? 'last' : 'first');
    } else {
      el.focus();
      setCaret(el, dir === 'left' ? Infinity : 0);
    }
    el.scrollIntoView?.({ block: 'nearest' });
    return true;
  };

  const editorApi: EditorApi = {
    placeholder,
    readOnly: locked,
    blockCount: blocks.length,
    remove: removeBlock,
    duplicate: (id) => {
      const b = blocksRef.current.find((x) => x.id === id);
      if (!b) return;
      const copy: Block = { ...b, id: blockId() };
      dispatch({ type: 'insert', after: id, block: copy });
      focusAfterRender(copy.id, 'end');
    },
    turnInto: (id, type) => {
      dispatch({ type: 'patch', id, patch: { type, ...(type === 'checkbox' ? { checked: false } : {}) } });
      focusAfterRender(id, 'end');
    },
    convert: (id, patch) => dispatch({ type: 'patch', id, patch }),
    setContent: (id, content) => dispatch({ type: 'patch', id, patch: { content } }),
    split: (id, before, after) => runPlan(splitBlockPlan(blocksRef.current, id, before, after)),
    mergePrev: (id, text) => {
      const plan = mergePrevPlan(blocksRef.current, id, text);
      runPlan(plan);
      if (slash?.blockId === id) setSlash(null);
    },
    mergeNext: (id, text) => {
      const plan = mergeNextPlan(blocksRef.current, id, text);
      if (plan.actions.length === 0) return false;
      runPlan(plan);
      return true;
    },
    markdown: (id, md, text) => runPlan(markdownPlan(id, md, text)),
    pasteLines: (id, before, lines, after) => runPlan(pasteLinesPlan(blocksRef.current, id, before, lines, after)),
    pasteFiles: (id, files) => {
      if (files.length && adapters?.upload) void adapters.upload(files, { blockId: id });
    },
    navigate,
    insertAfter: (id) => { insertAfter(id); },
    openSlash: (id, next) => {
      if (locked) return;
      if (!next) {
        setSlash((prev) => (prev?.blockId === id ? null : prev));
        return;
      }
      setSlash({ blockId: id, ...next });
    },
    selectFromEdge: blockSel.selectFromEdge,
    selectAll: blockSel.selectAll,
    dragStart: onDragStartBlock,
    dragOver: onDragOverBlock,
    drop: onDropBlock,
    dragEnd: () => {
      dragIdRef.current = null;
      setDropHint(null);
    },
  };

  const commands: CommandDef[] = useMemo(() => {
    const host = extraCommandsFromAdapters(adapters ?? {});
    const extras = (extraCommands ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      hint: c.hint,
      keywords: c.keywords ?? '',
      group: 'create' as const,
    }));
    return [...SLASH_COMMANDS, ...host, ...extras];
  }, [adapters, extraCommands]);

  const headings = useMemo(
    () => blocks
      .filter((b) => b.type === 'h1' || b.type === 'h2' || b.type === 'h3')
      .map((b) => ({ id: b.id, type: b.type, label: (b.content ?? '').trim() }))
      .filter((h) => h.label.length > 0),
    [blocks],
  );

  const focusOrAppendLine = () => {
    if (locked) return;
    const last = blocksRef.current[blocksRef.current.length - 1];
    if (last && last.type === 'text' && !(last.content ?? '').replace(/\u200B/g, '')) {
      focusBlock(last.id, 'end');
      return;
    }
    insertAfter(last?.id ?? null);
  };

  return (
    <div className={`pe-editor${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`} data-readonly={locked || undefined}>
      <div className="pe-toolbar">
        {notice && !locked && (
          <div className="pe-notice" role="status">
            <span>{notice.label}</span>
            <button type="button" onClick={() => { notice.undo(); setNotice(null); }}>Undo</button>
          </div>
        )}
        <ShortcutsHelp />
      </div>
      {headings.length > 0 && (
        <nav className="pe-toc" aria-label="Document contents">
          {headings.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`pe-toc-item pe-toc-${h.type}`}
              onClick={() => {
                document.querySelector<HTMLElement>(`[data-row-id="${cssId(h.id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                requestAnimationFrame(() => focusBlock(h.id));
              }}
            >
              {h.label}
            </button>
          ))}
        </nav>
      )}
      <div
        ref={canvasRef}
        onMouseDownCapture={locked ? undefined : blockSel.onCanvasMouseDownCapture}
        data-block-selecting={blockSel.selecting ? 'true' : undefined}
        className={blockSel.selecting ? 'pe-selecting' : undefined}
      >
        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            index={i}
            blocks={blocks}
            api={editorApi}
            slashOpen={slash?.blockId === b.id}
            dropHint={dropHint?.id === b.id ? dropHint.pos : null}
            selected={blockSel.selectedSet.has(b.id)}
          />
        ))}
      </div>
      {blockSel.sink}
      {!locked && (
        <button type="button" onClick={focusOrAppendLine} className="pe-append" contentEditable={false}>
          Click to write, or press <kbd>/</kbd> for commands…
        </button>
      )}
      {slash && !locked && (
        <SlashMenu
          open
          query={slash.query}
          anchorRect={slash.rect}
          commands={commands}
          onPick={onPickSlash}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}
