/**
 * Pure key-command / paste / slash transforms extracted from Hoppa NotesTab
 * (allebrum/company-portal, commit dcea05ee655308385581660b1e38ac6213249791).
 * Licensed under AGPL-3.0. See LICENSE and NOTICE.
 */
import {
  blockId,
  emptyText,
  isEditable,
  isEmptyContent,
  isList,
  removeSlashToken,
  type Action,
} from './blocks';
import type { MarkdownShortcut } from './blocks';
import type { Block, BlockType } from './types';

export type FocusHint = { id: string; pos: number | 'start' | 'end' };

export type EditResult = {
  actions: Action[];
  focus?: FocusHint;
  host?: { kind: 'mention' | 'upload' | 'embed'; blockId: string; caret: number };
};

export function splitBlockPlan(blocks: Block[], id: string, before: string, after: string): EditResult {
  const b = blocks.find((x) => x.id === id);
  if (!b) return { actions: [] };
  const nextType: BlockType = isList(b.type) ? b.type : 'text';
  if (before === '' && after !== '') {
    return {
      actions: [{ type: 'insertBefore', before: id, block: { id: blockId(), type: nextType, content: '' } }],
      focus: { id, pos: 0 },
    };
  }
  const nb: Block = {
    id: blockId(),
    type: nextType,
    content: after,
    ...(nextType === 'checkbox' ? { checked: false } : {}),
  };
  return {
    actions: [
      { type: 'patch', id, patch: { content: before } },
      { type: 'insert', after: id, block: nb },
    ],
    focus: { id: nb.id, pos: 0 },
  };
}

export function mergePrevPlan(blocks: Block[], id: string, text: string): EditResult {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx <= 0) return { actions: [] };
  const prev = blocks[idx - 1]!;
  if (prev.type === 'divider') {
    return { actions: [{ type: 'remove', id: prev.id }], focus: { id, pos: 0 } };
  }
  if (!isEditable(prev)) {
    return { actions: [], focus: { id: prev.id, pos: 'end' } };
  }
  const prevText = prev.content ?? '';
  return {
    actions: [
      { type: 'patch', id: prev.id, patch: { content: prevText + text } },
      { type: 'remove', id },
    ],
    focus: { id: prev.id, pos: prevText.length },
  };
}

export function mergeNextPlan(blocks: Block[], id: string, text: string): EditResult {
  const idx = blocks.findIndex((b) => b.id === id);
  const next = blocks[idx + 1];
  if (idx === -1 || !next) return { actions: [] };
  if (next.type === 'divider') {
    return { actions: [{ type: 'remove', id: next.id }] };
  }
  if (!isEditable(next)) return { actions: [] };
  return {
    actions: [
      { type: 'patch', id, patch: { content: text + (next.content ?? '') } },
      { type: 'remove', id: next.id },
    ],
    focus: { id, pos: text.length },
  };
}

export function markdownPlan(id: string, md: MarkdownShortcut, text: string): EditResult {
  if (md.kind === 'divider') {
    const nb = emptyText();
    return {
      actions: [
        { type: 'patch', id, patch: { type: 'divider', content: '' } },
        { type: 'insert', after: id, block: nb },
      ],
      focus: { id: nb.id, pos: 0 },
    };
  }
  return {
    actions: [{
      type: 'patch',
      id,
      patch: {
        type: md.type,
        content: text.slice(md.strip),
        ...(md.type === 'checkbox' ? { checked: false } : {}),
      },
    }],
    focus: { id, pos: 0 },
  };
}

export function pasteLinesPlan(
  blocks: Block[],
  id: string,
  before: string,
  lines: string[],
  after: string,
): EditResult {
  const b = blocks.find((x) => x.id === id);
  if (!b || lines.length === 0) return { actions: [] };
  const nextType: BlockType = isList(b.type) ? b.type : 'text';
  const last = lines.length - 1;
  const actions: Action[] = [
    { type: 'patch', id, patch: { content: before + (lines[0] ?? '') + (last === 0 ? after : '') } },
  ];
  const rest: Block[] = lines.slice(1).map((line, i) => ({
    id: blockId(),
    type: nextType,
    content: i + 1 === last ? line + after : line,
    ...(nextType === 'checkbox' ? { checked: false } : {}),
  }));
  if (rest.length > 0) {
    actions.push({ type: 'insertMany', after: id, blocks: rest });
    return { actions, focus: { id: rest[rest.length - 1]!.id, pos: (lines[last] ?? '').length } };
  }
  return { actions, focus: { id, pos: before.length + (lines[0] ?? '').length } };
}

export function slashPickPlan(
  blocks: Block[],
  blockIdTarget: string,
  tokenStart: number,
  query: string,
  cmd: string,
  /** How to cut the `/query` token out of the content (v2 editors pass a marks-aware version). */
  removeToken: (content: string, tokenStart: number, query: string) => { content: string; caret: number } = removeSlashToken,
): EditResult {
  const target = blocks.find((b) => b.id === blockIdTarget);
  if (!target) return { actions: [] };
  const { content: rest, caret } = removeToken(target.content ?? '', tokenStart, query);

  if (
    cmd === 'h1' || cmd === 'h2' || cmd === 'h3' || cmd === 'text' ||
    cmd === 'bullet' || cmd === 'numbered' || cmd === 'checkbox' ||
    cmd === 'quote' || cmd === 'callout'
  ) {
    return {
      actions: [{
        type: 'patch',
        id: target.id,
        patch: { type: cmd, content: rest, ...(cmd === 'checkbox' ? { checked: false } : {}) },
      }],
      focus: { id: target.id, pos: caret },
    };
  }

  if (cmd === 'mention' || cmd === 'upload' || cmd === 'embed') {
    return {
      actions: [{ type: 'patch', id: target.id, patch: { content: rest } }],
      focus: { id: target.id, pos: caret },
      host: { kind: cmd, blockId: target.id, caret },
    };
  }

  let activeBlockId = target.id;
  const actions: Action[] = [];
  if (isEmptyContent(rest)) {
    actions.push({ type: 'patch', id: target.id, patch: { content: '' } });
  } else {
    const nb = emptyText();
    actions.push({ type: 'patch', id: target.id, patch: { content: rest } });
    actions.push({ type: 'insert', after: target.id, block: nb });
    activeBlockId = nb.id;
  }

  if (cmd === 'divider') {
    const after = emptyText();
    actions.push({ type: 'patch', id: activeBlockId, patch: { type: 'divider', content: '' } });
    actions.push({ type: 'insert', after: activeBlockId, block: after });
    return { actions, focus: { id: after.id, pos: 0 } };
  }

  return { actions: [{ type: 'patch', id: target.id, patch: { content: rest } }], focus: { id: target.id, pos: caret } };
}

