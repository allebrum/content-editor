/**
 * Derived from https://github.com/allebrum/company-portal
 * source path: apps/web/src/components/space/notes/selection.ts
 * upstream commit: dcea05ee655308385581660b1e38ac6213249791
 * Licensed under the GNU Affero General Public License v3.0.
 * See LICENSE and NOTICE in this repository.
 */

/**
 * Cross-block ("block-level") selection for the Notes canvas, Notion style.
 *
 * Each block is its own contentEditable, and browsers confine a text
 * selection to one editing host, so a native drag can't extend past a line.
 * Instead of fighting that (one giant contentEditable would break the
 * per-block model, the slash menu, drag-reorder and the id-based live
 * merge), a drag/Shift+Click/Shift+Arrow that leaves a block switches to a
 * selection of whole blocks, tracked by id: { anchor, focus }. Ids survive
 * re-renders and live merges; this file holds the pure parts (range math,
 * pruning after a merge, keyboard extension, the Cmd/Ctrl+A two-step,
 * replacing a range, and clipboard serialization) so they're unit-tested.
 */
import { inlineToPlainText, renderInlineHtml } from './inline';
import type { AnyBlock, Block as SpaceBlock } from './types.js';
import { sanitizeImageSrc, videoWatchUrl } from './media';

export type BlockSelection = { anchor: string; focus: string };

/** Ids from anchor to focus inclusive, in document order. */
export function selectedIds(blocks: readonly Pick<SpaceBlock, 'id'>[], sel: BlockSelection | null): string[] {
  if (!sel) return [];
  const a = blocks.findIndex((b) => b.id === sel.anchor);
  const f = blocks.findIndex((b) => b.id === sel.focus);
  if (a === -1 || f === -1) return [];
  const [lo, hi] = a <= f ? [a, f] : [f, a];
  return blocks.slice(lo, hi + 1).map((b) => b.id);
}

/**
 * Keep a selection valid after the doc changed (remote merge, delete).
 * A vanished end collapses onto the surviving one; both gone → null.
 */
export function pruneSelection(blocks: readonly Pick<SpaceBlock, 'id'>[], sel: BlockSelection | null): BlockSelection | null {
  if (!sel) return null;
  const has = (id: string) => blocks.some((b) => b.id === id);
  const a = has(sel.anchor);
  const f = has(sel.focus);
  if (a && f) return sel;
  if (a) return { anchor: sel.anchor, focus: sel.anchor };
  if (f) return { anchor: sel.focus, focus: sel.focus };
  return null;
}

/** Shift+↑/↓ while blocks are selected: move the focus end, clamped. */
export function extendSelection(
  blocks: readonly Pick<SpaceBlock, 'id'>[],
  sel: BlockSelection,
  dir: 'up' | 'down',
): BlockSelection {
  const f = blocks.findIndex((b) => b.id === sel.focus);
  if (f === -1) return sel;
  const n = Math.max(0, Math.min(blocks.length - 1, f + (dir === 'up' ? -1 : 1)));
  return { anchor: sel.anchor, focus: blocks[n]!.id };
}

/** Select every block (anchor first, focus last). */
export function selectAll(blocks: readonly Pick<SpaceBlock, 'id'>[]): BlockSelection | null {
  if (blocks.length === 0) return null;
  return { anchor: blocks[0]!.id, focus: blocks[blocks.length - 1]!.id };
}

/**
 * Cmd/Ctrl+A inside a block: the first press selects the block's text
 * (native); once its whole text is already selected (or it is empty) the
 * next press selects all blocks.
 */
export function selectAllEscalates(textLength: number, start: number, end: number): boolean {
  if (textLength === 0) return true;
  return Math.min(start, end) === 0 && Math.max(start, end) >= textLength;
}

/**
 * Shift+↑/↓ inside a block becomes a block selection once the text
 * selection already reaches that edge of the block (the browser's own
 * Shift+↑ on the first line extends to the start first, so the press after
 * that crosses over).
 */
export function shiftArrowLeavesBlock(dir: 'up' | 'down', textLength: number, start: number, end: number): boolean {
  return dir === 'up' ? Math.min(start, end) === 0 : Math.max(start, end) >= textLength;
}

/** Selection made when Shift+↑/↓ crosses out of block `id`: it and its neighbour. */
export function selectionFromEdge(
  blocks: readonly Pick<SpaceBlock, 'id'>[],
  id: string,
  dir: 'up' | 'down',
): BlockSelection | null {
  const i = blocks.findIndex((b) => b.id === id);
  if (i === -1) return null;
  const j = Math.max(0, Math.min(blocks.length - 1, i + (dir === 'up' ? -1 : 1)));
  return { anchor: id, focus: blocks[j]!.id };
}

/**
 * Replace the selected range with `insert` (possibly nothing). Returns the
 * new doc, what was removed (for Undo) and the id the removed run followed.
 * A doc never ends up empty: deleting everything leaves one empty line.
 */
export function replaceSelection(
  blocks: readonly SpaceBlock[],
  ids: readonly string[],
  insert: readonly SpaceBlock[],
  makeEmpty: () => SpaceBlock,
): { blocks: SpaceBlock[]; removed: SpaceBlock[]; prevId: string | null; inserted: SpaceBlock[] } {
  const set = new Set(ids);
  const first = blocks.findIndex((b) => set.has(b.id));
  if (first === -1) return { blocks: [...blocks], removed: [], prevId: null, inserted: [] };
  const removed = blocks.filter((b) => set.has(b.id));
  const kept = blocks.filter((b) => !set.has(b.id));
  // Position in the kept list where the run used to start.
  const at = blocks.slice(0, first).filter((b) => !set.has(b.id)).length;
  let inserted = [...insert];
  if (kept.length === 0 && inserted.length === 0) inserted = [makeEmpty()];
  const next = [...kept.slice(0, at), ...inserted, ...kept.slice(at)];
  return { blocks: next, removed, prevId: at > 0 ? kept[at - 1]!.id : null, inserted };
}

/** Number shown for each numbered item (runs restart after any other block). */
export function listNumbers(blocks: readonly Pick<SpaceBlock, 'id' | 'type'>[]): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const b of blocks) {
    n = b.type === 'numbered' ? n + 1 : 0;
    if (b.type === 'numbered') out.set(b.id, n);
  }
  return out;
}

/**
 * Plain-text copy: one line per block with markdown prefixes, so pasting
 * back into Notes (or any markdown editor) rebuilds the structure. Soft
 * line breaks inside a quote/callout keep the "> " on every line.
 * `numbers` should come from the whole doc so "3." stays "3.".
 */
export function blocksToPlainText(
  selected: readonly SpaceBlock[],
  numbers: Map<string, number> = listNumbers(selected),
  opts: CopyOptions = {},
): string {
  return selected
    .map((b) => {
      const text = opts.inlineMarks ? inlineToPlainText(b.content) : (b.content ?? '').replace(/\u200B/g, '');
      const media = mediaPlainText(b as AnyBlock);
      if (media != null) return media;
      switch (b.type) {
        case 'h1': return `# ${text}`;
        case 'h2': return `## ${text}`;
        case 'h3': return `### ${text}`;
        case 'bullet': return `- ${text}`;
        case 'numbered': return `${numbers.get(b.id) ?? 1}. ${text}`;
        case 'checkbox': return `- [${b.checked ? 'x' : ' '}] ${text}`;
        case 'quote':
        case 'callout': return text.split('\n').map((l) => `> ${l}`).join('\n');
        case 'divider': return '---';
        default: return text;
      }
    })
    .join('\n');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const plainInline = (s: string | undefined) => escapeHtml((s ?? '').replace(/\u200B/g, '')).replace(/\n/g, '<br>');

/** `inlineMarks`: content is v2 (copy formatted text, not the stored markers). */
export type CopyOptions = { inlineMarks?: boolean };

/** HTML copy: real headings, grouped lists, checkboxes, quotes and rules. */
export function blocksToHtml(
  selected: readonly SpaceBlock[],
  numbers: Map<string, number> = listNumbers(selected),
  opts: CopyOptions = {},
): string {
  const inline = opts.inlineMarks ? (s: string | undefined) => renderInlineHtml(s) : plainInline;
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  const open = (kind: 'ul' | 'ol', start?: number) => {
    if (list === kind) return;
    close();
    out.push(kind === 'ol' && start && start !== 1 ? `<ol start="${start}">` : `<${kind}>`);
    list = kind;
  };
  for (const b of selected) {
    switch (b.type) {
      case 'bullet':
        open('ul');
        out.push(`<li>${inline(b.content)}</li>`);
        continue;
      case 'checkbox': {
        open('ul');
        const checked = b.checked ? ' checked' : '';
        out.push(`<li><input type="checkbox" disabled${checked}> ${inline(b.content)}</li>`);
        continue;
      }
      case 'numbered':
        open('ol', numbers.get(b.id));
        out.push(`<li>${inline(b.content)}</li>`);
        continue;
    }
    close();
    const media = mediaHtml(b as AnyBlock);
    if (media != null) {
      out.push(media);
      continue;
    }
    switch (b.type) {
      case 'h1': out.push(`<h1>${inline(b.content)}</h1>`); break;
      case 'h2': out.push(`<h2>${inline(b.content)}</h2>`); break;
      case 'h3': out.push(`<h3>${inline(b.content)}</h3>`); break;
      case 'quote':
      case 'callout': out.push(`<blockquote>${inline(b.content)}</blockquote>`); break;
      case 'divider': out.push('<hr>'); break;
      default: out.push(`<p>${inline(b.content)}</p>`);
    }
  }
  close();
  return out.join('');
}

/** v2 media blocks copy as their URL / a link; null for text blocks. */
function mediaPlainText(b: AnyBlock): string | null {
  if (b.type === 'image') return `![${b.alt ?? ''}](${b.src ?? ''})`;
  if (b.type === 'video' && b.provider && b.videoId) {
    return videoWatchUrl({ provider: b.provider, videoId: b.videoId, hash: b.hash }) ?? '';
  }
  return null;
}

function mediaHtml(b: AnyBlock): string | null {
  if (b.type === 'image') {
    const src = sanitizeImageSrc(b.src);
    return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(b.alt ?? '')}">` : '';
  }
  if (b.type === 'video') {
    const href = b.provider && b.videoId ? videoWatchUrl({ provider: b.provider, videoId: b.videoId, hash: b.hash }) : null;
    return href ? `<p><a href="${escapeHtml(href)}">${escapeHtml(b.title || href)}</a></p>` : '';
  }
  return null;
}
