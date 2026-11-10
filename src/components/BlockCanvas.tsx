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
  readText, setCaret, setSelectionRange, writeText,
} from '../dom';
import {
  activeMarks, applyMarksToRange, autoFormat, AUTOFORMAT_TRIGGERS, contentLength, insertContent, insertRich,
  joinContent, marksAt, richFromContent, sliceContent, toggleMarks, toggleRichMark, type Marks,
} from '../rich';
import { htmlToContentLines, needsRichNormalize, readRichContent, writeRich } from '../rich-dom';
import { selectAllEscalates, shiftArrowLeavesBlock } from '../selection';
import type { AnyBlock, Block, BlockType, VideoBlock, VideoProvider } from '../types';
import { inlineToPlainText, type InlineMark } from '../inline';
import { parseVideoUrl, providerLabel, sanitizeImageSrc } from '../media';
import { VideoEmbed } from '../renderer';
import { Popover } from './Popover';

export type SlashOpen = { rect: { x: number; y: number; top: number }; query: string; tokenStart: number };

export type EditorApi = {
  placeholder: string;
  ariaLabel?: string;
  readOnly: boolean;
  blockCount: number;
  /** First block id when every editable block is empty — one idle placeholder. */
  idlePlaceholderBlockId: string | null;
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
  /** True for version 2 documents: inline marks and media blocks are enabled. */
  inlineMarks: boolean;
  applyMark: (id: string, mark: InlineMark) => void;
  /** v2: ask the host for a link URL; resolves to a safe href or null. */
  requestLink: (selectedText: string) => Promise<string | null>;
  /** v2: blocks register a handle so the format bar can reach them. Returns an unregister function. */
  registerRich: (id: string, handle: RichHandle) => () => void;
  /** v2: the marks at the selection may have changed (refresh the format bar). */
  marksChanged: () => void;
  patchMedia: (id: string, patch: Partial<AnyBlock>) => void;
  uploads: Record<string, PendingUpload>;
  pickImage: (id: string) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  canUploadImages: boolean;
  videoProviders: readonly VideoProvider[];
};

export type PendingUpload = { fileName: string; progress: number; error?: string };

export const IMAGE_WIDTH_OPTIONS: readonly { value: number | null; label: string }[] = [
  { value: null, label: 'Full width' },
  { value: 720, label: 'Large (720px)' },
  { value: 480, label: 'Medium (480px)' },
  { value: 320, label: 'Small (320px)' },
];

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
      ) : (block.type as string) === 'image' ? (
        <ImageCard block={block as unknown as AnyBlock} api={api} />
      ) : (block.type as string) === 'video' ? (
        <VideoCard block={block as unknown as AnyBlock} api={api} />
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

function cardKeyHandler(block: { id: string }, api: EditorApi) {
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
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
}

function DividerShell({ block, api }: { block: Block; api: EditorApi }) {
  return (
    <div
      data-card-id={block.id}
      tabIndex={-1}
      onKeyDown={cardKeyHandler(block, api)}
      contentEditable={false}
      className="pe-divider-wrap"
    >
      <hr className="pe-divider" />
    </div>
  );
}

function ImageCard({ block, api }: { block: AnyBlock; api: EditorApi }) {
  const upload = api.uploads[block.id];
  const src = sanitizeImageSrc(block.src);
  const pct = upload ? Math.round(Math.max(0, Math.min(1, upload.progress)) * 100) : 0;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      data-card-id={block.id}
      tabIndex={-1}
      onKeyDown={cardKeyHandler(block, api)}
      contentEditable={false}
      className="pe-media pe-media-image"
      data-testid={`image-${block.id}`}
    >
      {src ? (
        <figure className="pe-image" style={block.width ? { maxWidth: block.width } : undefined}>
          <img src={src} alt={block.alt ?? ''} className="pe-media-img" />
          {api.readOnly && block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      ) : upload ? (
        <div className="pe-upload" role="status">
          <div
            className="pe-progress"
            role="progressbar"
            aria-label={`Uploading ${upload.fileName}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div className="pe-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="pe-upload-label">
            {upload.error ? upload.error : `Uploading ${upload.fileName}… ${pct}%`}
          </span>
          {!api.readOnly && (
            <span className="pe-upload-actions">
              {upload.error && (
                <button type="button" className="pe-btn" onClick={() => api.retryUpload(block.id)}>Retry</button>
              )}
              <button type="button" className="pe-btn" onClick={() => api.cancelUpload(block.id)}>
                {upload.error ? 'Remove' : 'Cancel'}
              </button>
            </span>
          )}
        </div>
      ) : (
        <div className="pe-media-empty">
          {api.canUploadImages && !api.readOnly ? (
            <button type="button" className="pe-btn" onClick={() => api.pickImage(block.id)}>Choose an image…</button>
          ) : (
            <span>Image unavailable</span>
          )}
        </div>
      )}
      {src && !api.readOnly && (
        <div className="pe-media-fields" onKeyDown={stop}>
          <label className="pe-field">
            <span>Alt text</span>
            <input
              type="text"
              value={block.alt ?? ''}
              maxLength={500}
              placeholder="Describe the image for people who can't see it"
              onChange={(e) => api.patchMedia(block.id, { alt: e.target.value })}
            />
          </label>
          {!block.alt && <p className="pe-media-warn">Add alt text, or leave empty only if the image is decorative.</p>}
          <label className="pe-field">
            <span>Caption</span>
            <input
              type="text"
              value={block.caption ?? ''}
              maxLength={1000}
              placeholder="Optional caption"
              onChange={(e) => api.patchMedia(block.id, { caption: e.target.value || undefined })}
            />
          </label>
          <label className="pe-field pe-field-inline">
            <span>Width</span>
            <select
              value={block.width == null ? '' : String(block.width)}
              onChange={(e) => api.patchMedia(block.id, { width: e.target.value ? Number(e.target.value) : undefined })}
            >
              {IMAGE_WIDTH_OPTIONS.map((o) => (
                <option key={o.label} value={o.value == null ? '' : String(o.value)}>{o.label}</option>
              ))}
            </select>
          </label>
          {api.canUploadImages && (
            <button type="button" className="pe-btn" onClick={() => api.pickImage(block.id)}>Replace image</button>
          )}
        </div>
      )}
    </div>
  );
}

function VideoCard({ block, api }: { block: AnyBlock; api: EditorApi }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const names = api.videoProviders.map(providerLabel).join(' or ');
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const embed = () => {
    const parsed = parseVideoUrl(url, api.videoProviders);
    if (!parsed) {
      setError(`Paste a ${names} video link.`);
      return;
    }
    setError(null);
    api.patchMedia(block.id, { provider: parsed.provider, videoId: parsed.videoId, hash: parsed.hash });
  };
  const ready = !!(block.provider && block.videoId);
  return (
    <div
      data-card-id={block.id}
      tabIndex={-1}
      onKeyDown={cardKeyHandler(block, api)}
      contentEditable={false}
      className="pe-media pe-media-video"
      data-testid={`video-${block.id}`}
    >
      {ready ? (
        <VideoEmbed block={block as unknown as VideoBlock} />
      ) : api.readOnly ? (
        <div className="pe-media-empty">Video not set</div>
      ) : (
        // Not a <form>: the editor is often placed inside a host form, and a
        // nested form's submit would bubble (through React) to the host's onSubmit.
        <div
          role="group"
          aria-label={`Embed a ${names} video`}
          className="pe-video-form"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              embed();
            }
          }}
        >
          <input
            type="url"
            value={url}
            autoFocus
            aria-label={`${names} link`}
            placeholder={`Paste a ${names} link`}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="button" className="pe-btn" onClick={embed}>Embed</button>
          <button type="button" className="pe-btn" onClick={() => api.remove(block.id)}>Cancel</button>
          {error && <p className="pe-media-warn" role="alert">{error}</p>}
        </div>
      )}
      {ready && !api.readOnly && (
        <div className="pe-media-fields" onKeyDown={stop}>
          <label className="pe-field">
            <span>Title</span>
            <input
              type="text"
              value={block.title ?? ''}
              maxLength={500}
              placeholder="Describes the video for screen readers"
              onChange={(e) => api.patchMedia(block.id, { title: e.target.value || undefined })}
            />
          </label>
          <label className="pe-field">
            <span>Caption</span>
            <input
              type="text"
              value={block.caption ?? ''}
              maxLength={1000}
              placeholder="Optional caption"
              onChange={(e) => api.patchMedia(block.id, { caption: e.target.value || undefined })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

type Snap = { content: string; start: number; end: number };
type History = { undo: Snap[]; redo: Snap[]; last: number; kind: 'type' | 'edit' | null };
const HISTORY_LIMIT = 200;
const TYPING_GROUP_MS = 1000;

/** Per-block handle the editor uses for the format bar (v2 only). */
export type RichHandle = {
  applyMark: (mark: InlineMark) => void;
  /** Marks at the current selection, or null when the block has no selection. */
  marks: () => Marks | null;
};

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
  /** v2: formatted spans in the DOM, visible-text offsets, stored markers. */
  const rich = api.inlineMarks;
  const pendingRef = useRef<{ at: number; marks: Marks } | null>(null);
  const compositionStartRef = useRef<number | null>(null);
  const historyRef = useRef<History>({ undo: [], redo: [], last: 0, kind: null });
  const stateRef = useRef<Snap>({ content, start: 0, end: 0 });
  /** Latest stored content (handlers may run before a re-render). */
  const contentRef = useRef(content);
  contentRef.current = content;
  const save = (next: string) => {
    if (next === contentRef.current) return;
    contentRef.current = next;
    api.setContent(block.id, next);
  };

  const paint = (el: HTMLElement, c: string) => (rich ? writeRich(el, c) : writeText(el, c));
  const visibleLength = (c: string) => (rich ? contentLength(c) : c.length);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || composingRef.current) return;
    if (content !== stateRef.current.content) {
      // Changed outside this block's own typing (split, merge, host value): new history.
      historyRef.current = { undo: [], redo: [], last: 0, kind: null };
      stateRef.current = { content, start: 0, end: 0 };
      pendingRef.current = null;
    }
    const stale = rich
      ? readRichContent(el) !== content || needsRichNormalize(el, content)
      : readText(el, { ignoreTrailingBr: true }) !== content || needsNormalize(el, content);
    if (!stale) return;
    const hadFocus = document.activeElement === el;
    const off = hadFocus ? getOffsets(el) : null;
    paint(el, content);
    if (hadFocus) {
      const len = visibleLength(content);
      setSelectionRange(el, Math.min(off?.start ?? len, len), Math.min(off?.end ?? len, len));
    }
  }, [content, block.id, block.type, rich]);

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

  /** Save the state before a change for Undo; quick typing collapses into one step. */
  const pushHistory = (kind: 'type' | 'edit', sel?: { start: number; end: number }) => {
    if (!rich) return;
    const h = historyRef.current;
    const now = Date.now();
    if (kind === 'type' && h.kind === 'type' && now - h.last < TYPING_GROUP_MS && h.undo.length) {
      h.last = now;
      return;
    }
    h.undo.push(sel ? { content: stateRef.current.content, start: sel.start, end: sel.end } : { ...stateRef.current });
    if (h.undo.length > HISTORY_LIMIT) h.undo.shift();
    h.redo = [];
    h.kind = kind;
    h.last = now;
  };

  /**
   * `text` is what the reader sees, `stored` the block content to save
   * (the same string for v1). `caret` is a visible offset.
   */
  const commit = (el: HTMLDivElement, text: string, caret: number, stored: string = text, kind: 'type' | 'edit' = 'type') => {
    if (api.readOnly) return;
    if (block.type === 'text') {
      const md = matchMarkdownShortcut(text, caret);
      if (md) {
        api.openSlash(block.id, null);
        api.markdown(block.id, md, stored);
        return;
      }
    }
    if (stored !== stateRef.current.content) pushHistory(kind);
    stateRef.current = { content: stored, start: caret, end: caret };
    save(stored);
    api.marksChanged();

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

  /** v2: replace the block with `next` content, caret/selection at visible offsets. */
  const applyRich = (
    el: HTMLDivElement,
    next: string,
    start: number,
    end = start,
    kind: 'type' | 'edit' = 'edit',
    before?: { start: number; end: number },
  ) => {
    if (before && next !== stateRef.current.content) {
      pushHistory(kind, before);
      stateRef.current = { content: next, start, end };
    }
    writeRich(el, next);
    setSelectionRange(el, start, end);
    if (start !== end) {
      // A kept selection (mark toggles): commit without slash/markdown checks.
      if (next !== stateRef.current.content) pushHistory(kind);
      stateRef.current = { content: next, start, end };
      save(next);
      api.marksChanged();
      return;
    }
    commit(el, readText(el, { ignoreTrailingBr: true }), start, next, kind);
  };

  const handleInput = (e?: React.FormEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || composingRef.current || api.readOnly) return;
    const off = getOffsets(el);
    const text = readText(el, { ignoreTrailingBr: true });
    const caret = Math.min(off?.end ?? text.length, text.length);
    if (!rich) {
      if (needsNormalize(el, text)) {
        writeText(el, text);
        setCaret(el, caret);
      }
      commit(el, text, caret);
      return;
    }
    const stored = readRichContent(el);
    if (needsRichNormalize(el, stored)) {
      writeRich(el, stored);
      setSelectionRange(el, Math.min(off?.start ?? caret, text.length), caret);
    }
    const native = e?.nativeEvent as InputEvent | undefined;
    const typed = native && native.inputType === 'insertText' && typeof native.data === 'string' ? native.data : null;
    if (typed && AUTOFORMAT_TRIGGERS.has(typed.slice(-1)) && (!off || off.start === off.end)) {
      const auto = autoFormat(stored, caret);
      if (auto) {
        // Undo goes back to the typed markers first.
        if (stored !== stateRef.current.content) pushHistory('type');
        stateRef.current = { content: stored, start: caret, end: caret };
        historyRef.current.kind = null;
        applyRich(el, auto.content, auto.caret, auto.caret, 'edit');
        // Keep typing unformatted after the converted text, like Notion.
        if (auto.applied !== 'link') {
          const m = marksAt(richFromContent(auto.content), auto.caret);
          pendingRef.current = { at: auto.caret, marks: { ...m, [auto.applied]: false } };
          api.marksChanged();
        }
        return;
      }
    }
    commit(el, text, caret, stored);
  };

  const undo = (redo: boolean) => {
    const el = ref.current;
    if (!el || api.readOnly) return;
    const h = historyRef.current;
    const from = redo ? h.redo : h.undo;
    const snap = from.pop();
    if (!snap) return;
    (redo ? h.undo : h.redo).push({ ...stateRef.current });
    h.kind = null;
    pendingRef.current = null;
    stateRef.current = { ...snap };
    writeRich(el, snap.content);
    setSelectionRange(el, snap.start, snap.end);
    save(snap.content);
    api.marksChanged();
  };

  const insertAtCaret = (insert: string) => {
    const el = ref.current;
    if (!el) return;
    const text = readText(el, { ignoreTrailingBr: true });
    const off = getOffsets(el) ?? { start: text.length, end: text.length };
    if (rich) {
      const res = insertRich(readRichContent(el), off.start, off.end, insert, pendingAt(off.start));
      pendingRef.current = null;
      applyRich(el, res.content, res.caret, res.caret, 'type');
      return;
    }
    const next = text.slice(0, off.start) + insert + text.slice(off.end);
    const caret = off.start + insert.length;
    writeText(el, next);
    setCaret(el, caret);
    commit(el, next, caret);
  };

  const pendingAt = (offset: number): Marks | undefined => {
    const p = pendingRef.current;
    return p && p.at === offset ? p.marks : undefined;
  };

  const applyMark = async (mark: InlineMark) => {
    const el = ref.current;
    if (!el || api.readOnly || !rich) return;
    const stored = readRichContent(el);
    const len = contentLength(stored);
    const off = getOffsets(el) ?? { start: len, end: len };
    const collapsed = off.start === off.end;
    if (mark !== 'link' && collapsed) {
      // Nothing selected: toggle the marks the next typed characters get.
      const base = pendingAt(off.start) ?? marksAt(richFromContent(stored), off.start);
      pendingRef.current = { at: off.start, marks: toggleMarks(base, mark) };
      api.marksChanged();
      return;
    }
    let href: string | undefined;
    if (mark === 'link') {
      const active = activeMarks(stored, off.start, off.end);
      const insideLink = collapsed ? !!(richFromContent(stored)[off.start - 1]?.m.href) : !!active.href;
      if (!insideLink) {
        const plain = readText(el, { ignoreTrailingBr: true });
        const asked = await api.requestLink(plain.slice(off.start, off.end));
        if (!asked) {
          el.focus({ preventScroll: true });
          setSelectionRange(el, off.start, off.end);
          return;
        }
        href = asked;
      }
    }
    const current = readRichContent(el);
    const next = toggleRichMark(current, off.start, off.end, mark, href);
    el.focus({ preventScroll: true });
    if (next.content === current) {
      setSelectionRange(el, off.start, off.end);
      return;
    }
    applyRich(el, next.content, next.start, next.end, 'edit', off);
  };

  const handle: RichHandle = {
    applyMark: (mark) => { void applyMark(mark); },
    marks: () => {
      const el = ref.current;
      if (!el) return null;
      const off = getOffsets(el);
      if (!off) return null;
      const p = pendingRef.current;
      if (p && (off.start !== off.end || off.start !== p.at)) pendingRef.current = null;
      return pendingAt(off.start) && off.start === off.end
        ? pendingRef.current!.marks
        : activeMarks(readRichContent(el), off.start, off.end);
    },
  };
  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    if (!rich) return;
    return api.registerRich(block.id, {
      applyMark: (m) => handleRef.current.applyMark(m),
      marks: () => handleRef.current.marks(),
    });
  }, [rich, block.id, api.registerRich]);

  /** Native beforeinput: typing with toggled marks, and the browser's Undo/Redo commands. */
  const beforeInputRef = useRef<(e: InputEvent) => void>(() => undefined);
  beforeInputRef.current = (e: InputEvent) => {
    const el = ref.current;
    if (!el || !rich || api.readOnly) return;
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
      e.preventDefault();
      undo(e.inputType === 'historyRedo');
      return;
    }
    if (e.isComposing || composingRef.current) return;
    if (e.inputType !== 'insertText' || !e.data) return;
    const off = getOffsets(el);
    if (!off || off.start !== off.end) {
      pendingRef.current = null;
      return;
    }
    let p = pendingRef.current;
    if (p && off.start !== p.at) p = pendingRef.current = null;
    if (!p) {
      // Typing right after a link: browsers would extend the link; don't.
      const chars = richFromContent(readRichContent(el));
      const prev = chars[off.start - 1];
      if (!prev?.m.href || chars[off.start]?.m.href === prev.m.href) return;
      p = { at: off.start, marks: marksAt(chars, off.start) };
    }
    e.preventDefault();
    const res = insertRich(readRichContent(el), off.start, off.end, e.data, p.marks);
    pendingRef.current = null;
    applyRich(el, res.content, res.caret, res.caret, 'type');
  };
  useEffect(() => {
    const el = ref.current;
    if (!el || !rich) return;
    const listener = (e: Event) => beforeInputRef.current(e as InputEvent);
    el.addEventListener('beforeinput', listener);
    return () => el.removeEventListener('beforeinput', listener);
  }, [rich]);

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
    const stored = () => (rich ? readRichContent(el) : text);

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

    if (rich && (e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if ((k === 'z' && !e.shiftKey) || (k === 'z' && e.shiftKey) || (k === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey)) {
        e.preventDefault();
        undo(k === 'y' || e.shiftKey);
        return;
      }
    }

    if (api.inlineMarks && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
      const k = e.key.toLowerCase();
      const mark: InlineMark | null = k === 'b' ? 'bold' : k === 'i' ? 'italic' : k === 'e' ? 'code' : k === 'k' ? 'link' : null;
      if (mark) {
        e.preventDefault();
        if (rich) void applyMark(mark);
        else api.applyMark(block.id, mark);
        return;
      }
    }

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
        if (rich) {
          const c = stored();
          api.split(block.id, sliceContent(c, 0, off.start), sliceContent(c, off.end));
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
        if (index > 0) api.mergePrev(block.id, stored());
        return;
      }
      case 'Delete': {
        if (!collapsed || off.end !== text.length || mod) return;
        if (api.mergeNext(block.id, stored())) e.preventDefault();
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
    const el = ref.current;
    if (rich) {
      if (!el) return;
      // Formatted paste: only bold, italic, code and safe links survive.
      const html = e.clipboardData.getData('text/html');
      const raw = e.clipboardData.getData('text/plain');
      let lines = html ? htmlToContentLines(html) : [];
      if (!lines.length && raw) lines = pastedLines(raw).map((l) => insertRich('', 0, 0, l, {}).content);
      if (!lines.length) return;
      const text = readText(el, { ignoreTrailingBr: true });
      const off = getOffsets(el) ?? { start: text.length, end: text.length };
      const c = readRichContent(el);
      if (lines.length <= 1 || block.type === 'quote' || block.type === 'callout') {
        const joined = lines.length <= 1 ? (lines[0] ?? '') : joinContent(...lines.flatMap((l, i) => (i ? ['\n', l] : [l])));
        const res = insertContent(c, off.start, off.end, joined);
        pendingRef.current = null;
        applyRich(el, res.content, res.caret, res.caret, 'edit', off);
        return;
      }
      api.openSlash(block.id, null);
      api.pasteLines(block.id, sliceContent(c, 0, off.start), lines, sliceContent(c, off.end));
      return;
    }
    const raw = e.clipboardData.getData('text/plain');
    if (!raw) return;
    const lines = pastedLines(raw);
    if (lines.length <= 1 || block.type === 'quote' || block.type === 'callout') {
      insertAtCaret(lines.length <= 1 ? (lines[0] ?? '') : lines.join('\n'));
      return;
    }
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

  const empty = isEmptyContent(rich ? inlineToPlainText(content) : content);

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
        aria-label={api.ariaLabel || placeholderFor(block, true, api.placeholder) || 'Text'}
        data-block-id={block.id}
        data-rich={rich ? 'true' : undefined}
        data-empty={empty ? 'true' : 'false'}
        data-placeholder={placeholderFor(block, focused, api.placeholder, api.idlePlaceholderBlockId === block.id)}
        data-testid={`block-${block.id}`}
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onCompositionStart={() => {
          composingRef.current = true;
          const el = ref.current;
          if (el) {
            el.dataset.empty = 'false';
            compositionStartRef.current = getOffsets(el)?.start ?? null;
          }
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          const el = ref.current;
          const startAt = compositionStartRef.current;
          compositionStartRef.current = null;
          const marks = startAt != null ? pendingAt(startAt) : undefined;
          if (rich && el && marks && startAt != null) {
            // Text composed while typing marks were toggled gets those marks.
            const off = getOffsets(el);
            const end = off?.end ?? startAt;
            pendingRef.current = null;
            if (end > startAt) {
              const stored = applyMarksToRange(readRichContent(el), startAt, end, marks);
              applyRich(el, stored, end, end, 'type');
              return;
            }
          }
          handleInput();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          pendingRef.current = null;
          if (slashOpen) api.openSlash(block.id, null);
        }}
        className={`pe-text pe-text-${block.type}${block.type === 'checkbox' && block.checked ? ' is-checked' : ''}`}
      />
    </div>
  );
}

function placeholderFor(block: Block, focused: boolean, fallback: string, idle = false): string {
  if (!focused && !idle) return '';
  switch (block.type) {
    case 'h1': return 'Heading 1';
    case 'h2': return 'Heading 2';
    case 'h3': return 'Heading 3';
    case 'quote': return 'Quote';
    case 'callout': return 'Tip or callout';
    case 'bullet': return 'List item';
    case 'numbered': return 'List item';
    case 'checkbox': return 'Task';
    default: return fallback || "Press '/' for commands";
  }
}
