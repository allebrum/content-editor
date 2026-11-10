/**
 * Host-facing Hoppa-style block editor. Canvas behavior is derived from
 * allebrum/company-portal NotesTab (dcea05ee655308385581660b1e38ac6213249791)
 * without product stores, sockets, uploads, or auth.
 * Licensed under AGPL-3.0. See LICENSE and NOTICE.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Bold, Code, Italic, Link2 } from 'lucide-react';
import {
  blockId, emptyText, isEditable, isEmptyContent, reducer, removeSlashToken,
} from '../blocks';
import { extraCommandsFromAdapters, SLASH_COMMANDS, type CommandDef } from '../commands';
import { getOffsets, placeCaretNearX, readText, setCaret, setSelectionRange, writeText } from '../dom';
import {
  markdownPlan, mergeNextPlan, mergePrevPlan, pasteLinesPlan, slashPickPlan, splitBlockPlan,
} from '../editing';
import { documentsEqual, emptyDocument, migrateDocument, parseAnyDocument } from '../schema';
import type {
  AnyBlock, AnyEditorDocument, Block, DocumentVersion, EditorDocument, ExtraSlashCommand, HostAdapters,
  VideoProvider,
} from '../types';
import { DocumentParseError } from '../errors';
import { toggleInlineMark, type InlineMark } from '../inline';
import { DEFAULT_VIDEO_PROVIDERS, providerLabel, sanitizeImageSrc } from '../media';
import { sanitizeHref } from '../sanitize';
import { BlockRow, type EditorApi, type PendingUpload, type SlashOpen } from './BlockCanvas';
import { ShortcutsHelp } from './ShortcutsHelp';
import { SlashMenu } from './SlashMenu';
import { useBlockSelection } from './useBlockSelection';

const DRAG_MIME = 'application/x-page-editor-block';

type CaretPos = 'start' | 'end' | number;

export type BlockEditorProps<D extends AnyEditorDocument = EditorDocument> = {
  value?: D | null;
  onChange?: (next: D) => void;
  /**
   * Version to emit. Defaults to the version of `value` (1 when empty), so
   * existing hosts keep getting v1 documents. Pass 2 to enable inline marks
   * (Cmd/Ctrl+B, I, E, K and the format bar), image and video blocks; v1
   * values are migrated with `migrateDocument()`.
   */
  documentVersion?: DocumentVersion;
  /** v2 only. Providers allowed in Video blocks. Default: Vimeo only. */
  videoProviders?: readonly VideoProvider[];
  /** v2 only. Ask for a link URL (Cmd/Ctrl+K). Default: `window.prompt`. Return null to cancel. */
  requestLink?: (selectedText: string) => string | null | Promise<string | null>;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Used as the accessible name for editable blocks (e.g. "Project notes"). */
  ariaLabel?: string;
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

const MEDIA_COMMANDS = {
  image: { id: 'image', label: 'Image', hint: 'Upload an image', keywords: 'picture photo img upload media', group: 'create' as const },
  video: { id: 'video', label: 'Video', hint: 'Embed a video', keywords: 'vimeo youtube embed media movie', group: 'create' as const },
};

function isMediaType(t: string): t is 'image' | 'video' {
  return t === 'image' || t === 'video';
}

/** Pending media (no src / video id yet) lives in the canvas only, never in emitted documents. */
function emittable(blocks: Block[]): Block[] {
  return blocks.filter((b) => {
    const a = b as unknown as AnyBlock;
    if (a.type === 'image') return !!sanitizeImageSrc(a.src);
    if (a.type === 'video') return !!(a.provider && a.videoId);
    return true;
  });
}

function toDoc(version: DocumentVersion, blocks: Block[]): AnyEditorDocument {
  const list = emittable(blocks);
  return version === 2
    ? { version: 2, blocks: (list.length ? list : [emptyText()]) as AnyEditorDocument['blocks'] }
    : { version: 1, blocks: list.length ? list : [emptyText()] };
}

export function BlockEditor<D extends AnyEditorDocument = EditorDocument>({
  value,
  onChange,
  documentVersion,
  videoProviders = DEFAULT_VIDEO_PROVIDERS,
  requestLink,
  readOnly = false,
  disabled = false,
  placeholder = "Press '/' for commands",
  ariaLabel,
  adapters,
  extraCommands,
  className,
  onParseError,
}: BlockEditorProps<D>) {
  const locked = readOnly || disabled;
  const valueVersion = value && typeof value === 'object' && (value as { version?: unknown }).version === 2 ? 2 : 1;
  const version: DocumentVersion = documentVersion ?? valueVersion;
  const versionRef = useRef(version);
  versionRef.current = version;
  const [uploads, setUploads] = useState<Record<string, PendingUpload>>({});
  const uploadFiles = useRef(new Map<string, File>());
  const uploadControllers = useRef(new Map<string, AbortController>());
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
  const lastEmitted = useRef<AnyEditorDocument | null>(null);

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
      let parsed = parseAnyDocument(value);
      if (versionRef.current === 2 && parsed.version === 1) parsed = migrateDocument(parsed);
      if (versionRef.current === 1 && parsed.version === 2) {
        throw new DocumentParseError('unsupported_document', 'documentVersion is 1 but the value is a version 2 document.');
      }
      if (lastEmitted.current && documentsEqual(parsed, lastEmitted.current)) return;
      if (documentsEqual(parsed, toDoc(versionRef.current, blocksRef.current))) return;
      skipEmitRef.current = true;
      dispatch({ type: 'replace', blocks: parsed.blocks as Block[] });
    } catch (err) {
      if (err instanceof DocumentParseError) onParseError?.(err);
    }
  }, [value, onParseError]);

  useEffect(() => {
    const next = toDoc(versionRef.current, blocks);
    if (skipEmitRef.current) {
      skipEmitRef.current = false;
      lastEmitted.current = next as EditorDocument;
      return;
    }
    if (lastEmitted.current && documentsEqual(next, lastEmitted.current)) return;
    lastEmitted.current = next as EditorDocument;
    onChange?.(next as D);
  }, [blocks, onChange]);

  useEffect(() => () => {
    for (const c of uploadControllers.current.values()) c.abort();
  }, []);

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

  const setUpload = (id: string, next: PendingUpload | null) => {
    setUploads((prev) => {
      const copy = { ...prev };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  };

  const patchMedia = (id: string, patch: Partial<AnyBlock>) => {
    dispatch({ type: 'patch', id, patch: patch as unknown as Partial<Block> });
  };

  const startImageUpload = (id: string, file: File) => {
    const upload = adapters?.uploadImage;
    if (!upload) return;
    uploadControllers.current.get(id)?.abort();
    const controller = new AbortController();
    uploadControllers.current.set(id, controller);
    uploadFiles.current.set(id, file);
    setUpload(id, { fileName: file.name || 'image', progress: 0 });
    const finish = () => {
      if (uploadControllers.current.get(id) === controller) uploadControllers.current.delete(id);
    };
    upload(file, {
      blockId: id,
      signal: controller.signal,
      onProgress: (fraction) => {
        if (controller.signal.aborted) return;
        setUploads((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id]!, progress: fraction } } : prev));
      },
    }).then((res) => {
      finish();
      if (controller.signal.aborted) return;
      const src = sanitizeImageSrc(res?.src);
      if (!src) {
        setUpload(id, { fileName: file.name || 'image', progress: 0, error: 'Upload returned an unusable image URL.' });
        return;
      }
      const current = blocksRef.current.find((b) => b.id === id) as AnyBlock | undefined;
      patchMedia(id, {
        src,
        alt: current?.alt || res.alt || '',
        ...(res.assetKey ? { assetKey: res.assetKey } : { assetKey: undefined }),
      });
      uploadFiles.current.delete(id);
      setUpload(id, null);
    }, (err: unknown) => {
      finish();
      if (controller.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : 'Upload failed.';
      setUpload(id, { fileName: file.name || 'image', progress: 0, error: message });
    });
  };

  const pickImage = (id: string) => {
    if (!adapters?.uploadImage || locked) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) startImageUpload(id, file);
      else cancelIfEmpty(id);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      cancelIfEmpty(id);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  };

  const cancelIfEmpty = (id: string) => {
    const b = blocksRef.current.find((x) => x.id === id) as AnyBlock | undefined;
    if (b && b.type === 'image' && !b.src && !uploadControllers.current.has(id)) removeBlock(id, { focus: 'prev' });
  };

  const cancelUpload = (id: string) => {
    uploadControllers.current.get(id)?.abort();
    uploadControllers.current.delete(id);
    uploadFiles.current.delete(id);
    setUpload(id, null);
    const b = blocksRef.current.find((x) => x.id === id) as AnyBlock | undefined;
    if (b && !b.src) removeBlock(id, { focus: 'prev' });
  };

  const retryUpload = (id: string) => {
    const file = uploadFiles.current.get(id);
    if (file) startImageUpload(id, file);
    else pickImage(id);
  };

  /** Turn an empty text block into media, or insert media after it. Returns the media block id. */
  const placeMedia = (targetId: string, kind: 'image' | 'video'): string => {
    const target = blocksRef.current.find((b) => b.id === targetId);
    const base: Partial<AnyBlock> = kind === 'image' ? { type: 'image', alt: '' } : { type: 'video' };
    if (target && target.type === 'text' && isEmptyContent(target.content)) {
      dispatch({ type: 'patch', id: targetId, patch: { ...base, content: undefined } as unknown as Partial<Block> });
      return targetId;
    }
    const block = { id: blockId(), ...base } as unknown as Block;
    dispatch({ type: 'insert', after: targetId, block });
    return block.id;
  };

  const insertImages = (targetId: string, files: File[]) => {
    let anchor = targetId;
    files.forEach((file) => {
      const id = placeMedia(anchor, 'image');
      startImageUpload(id, file);
      anchor = id;
    });
  };

  const applyMark = async (id: string, mark: InlineMark) => {
    if (locked || versionRef.current !== 2) return;
    const el = editorEl(id);
    if (!el) return;
    const text = readText(el, { ignoreTrailingBr: true });
    const off = getOffsets(el) ?? { start: text.length, end: text.length };
    let href: string | undefined;
    if (mark === 'link') {
      const selected = text.slice(off.start, off.end);
      const ask = requestLink ?? ((sel: string) => (typeof window !== 'undefined' && window.prompt ? window.prompt('Link URL', sel.startsWith('http') ? sel : 'https://') : null));
      const raw = await ask(selected);
      const safe = raw ? sanitizeHref(raw) : null;
      if (!safe) {
        if (raw) notify('That link is not allowed', () => undefined);
        return;
      }
      href = safe;
    }
    const next = toggleInlineMark(text, off.start, off.end, mark, href);
    if (next.content === text) return;
    writeText(el, next.content);
    el.focus({ preventScroll: true });
    setSelectionRange(el, next.start, next.end);
    dispatch({ type: 'patch', id, patch: { content: next.content } });
  };

  const activeBlockId = (): string | null => {
    const active = document.activeElement as HTMLElement | null;
    const id = active?.getAttribute?.('data-block-id');
    return id && blocksRef.current.some((b) => b.id === id) ? id : null;
  };

  const onPickSlash = (cmd: string) => {
    const s = slash;
    if (!s) return;
    setSlash(null);
    if (version === 2 && isMediaType(cmd)) {
      const target = blocksRef.current.find((b) => b.id === s.blockId);
      if (!target) return;
      const { content: rest } = removeSlashToken(target.content ?? '', s.tokenStart, s.query);
      dispatch({ type: 'patch', id: target.id, patch: { content: rest } });
      blocksRef.current = blocksRef.current.map((b) => (b.id === target.id ? { ...b, content: rest } : b));
      const id = placeMedia(target.id, cmd);
      if (cmd === 'image') pickImage(id);
      return;
    }
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

  const docEmpty = blocks.length > 0 && blocks.every((b) => isEditable(b) && isEmptyContent(b.content));
  const editorApi: EditorApi = {
    placeholder,
    ariaLabel,
    readOnly: locked,
    blockCount: blocks.length,
    idlePlaceholderBlockId: docEmpty ? (blocks[0]?.id ?? null) : null,
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
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (version === 2 && adapters?.uploadImage && images.length === files.length && images.length > 0) {
        insertImages(id, images);
        return;
      }
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
    inlineMarks: version === 2,
    applyMark: (id, mark) => { void applyMark(id, mark); },
    patchMedia,
    uploads,
    pickImage,
    retryUpload,
    cancelUpload,
    canUploadImages: !!adapters?.uploadImage,
    videoProviders,
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
    const media: CommandDef[] = [];
    if (version === 2) {
      if (adapters?.uploadImage) media.push(MEDIA_COMMANDS.image);
      if (videoProviders.length) {
        media.push({ ...MEDIA_COMMANDS.video, hint: `Embed a ${videoProviders.map(providerLabel).join(' or ')} video` });
      }
    }
    return [...SLASH_COMMANDS, ...media, ...host, ...extras];
  }, [adapters, extraCommands, version, videoProviders]);

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
        {version === 2 && !locked && (
          <div className="pe-format" role="toolbar" aria-label="Text formatting">
            {FORMAT_BUTTONS.map((f) => (
              <button
                key={f.mark}
                type="button"
                className={`pe-format-btn pe-format-${f.mark}`}
                title={`${f.label} (${f.keys})`}
                aria-label={f.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const id = activeBlockId();
                  if (id) void applyMark(id, f.mark);
                }}
              >
                <f.icon className="pe-icon" aria-hidden="true" />
              </button>
            ))}
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
        <button
          type="button"
          onClick={focusOrAppendLine}
          className="pe-append"
          contentEditable={false}
          aria-label="Continue writing"
          data-testid="page-editor-append"
        />
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

const FORMAT_BUTTONS: readonly {
  mark: InlineMark; label: string; icon: typeof Bold; keys: string;
}[] = [
  { mark: 'bold', label: 'Bold', icon: Bold, keys: 'Ctrl/⌘+B' },
  { mark: 'italic', label: 'Italic', icon: Italic, keys: 'Ctrl/⌘+I' },
  { mark: 'code', label: 'Inline code', icon: Code, keys: 'Ctrl/⌘+E' },
  { mark: 'link', label: 'Link', icon: Link2, keys: 'Ctrl/⌘+K' },
];
