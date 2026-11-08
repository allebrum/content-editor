/**
 * Portable slash commands and Turn-into targets.
 * Derived conceptually from allebrum/company-portal notes/commands.ts
 * (upstream dcea05ee655308385581660b1e38ac6213249791) with Hoppa product
 * actions (todo, goal, timer, link, embed, mention, upload) removed from
 * the built-in list. Hosts may pass extra slash commands when they provide
 * adapters; those extras are not claimed as supported block types.
 */
import type { BlockType } from './types';

export type SlashGroup = 'basic' | 'create';

export const SLASH_GROUP_LABELS: Record<SlashGroup, string> = {
  basic: 'Basic blocks',
  create: 'Create',
};

export type SlashCommandId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'checkbox'
  | 'quote'
  | 'callout'
  | 'divider';

export type CommandDef = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  group: SlashGroup;
};

export const SLASH_COMMANDS: readonly CommandDef[] = [
  { id: 'text', label: 'Text', hint: 'Plain paragraph', keywords: 'paragraph p body', group: 'basic' },
  { id: 'h1', label: 'Heading 1', hint: 'Large title', keywords: 'title heading h1', group: 'basic' },
  { id: 'h2', label: 'Heading 2', hint: 'Section heading', keywords: 'heading h2 subtitle', group: 'basic' },
  { id: 'h3', label: 'Heading 3', hint: 'Subsection', keywords: 'heading h3', group: 'basic' },
  { id: 'bullet', label: 'Bulleted list', hint: 'Unordered list', keywords: 'list ul bullet unordered', group: 'basic' },
  { id: 'numbered', label: 'Numbered list', hint: 'Ordered list', keywords: 'list ol numbered ordered', group: 'basic' },
  { id: 'checkbox', label: 'Checkbox', hint: 'To-do style checklist item', keywords: 'todo check task checklist', group: 'basic' },
  { id: 'quote', label: 'Quote', hint: 'Quoted passage', keywords: 'blockquote citation', group: 'basic' },
  { id: 'callout', label: 'Callout', hint: 'Highlighted note', keywords: 'note info callout highlight', group: 'basic' },
  { id: 'divider', label: 'Divider', hint: 'Horizontal rule', keywords: 'hr rule separator line', group: 'basic' },
];

export const TURN_INTO_OPTIONS: readonly { type: BlockType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'h1', label: 'Heading 1' },
  { type: 'h2', label: 'Heading 2' },
  { type: 'h3', label: 'Heading 3' },
  { type: 'bullet', label: 'Bulleted list' },
  { type: 'numbered', label: 'Numbered list' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'quote', label: 'Quote' },
  { type: 'callout', label: 'Callout' },
];

export function extraCommandsFromAdapters(adapters: {
  mention?: unknown;
  upload?: unknown;
  embed?: unknown;
}): CommandDef[] {
  const extras: CommandDef[] = [];
  if (adapters.mention) {
    extras.push({ id: 'mention', label: 'Mention', hint: 'Ask the host to insert a mention', keywords: 'at person user', group: 'create' });
  }
  if (adapters.upload) {
    extras.push({ id: 'upload', label: 'Upload', hint: 'Ask the host to handle a file', keywords: 'file image attach', group: 'create' });
  }
  if (adapters.embed) {
    extras.push({ id: 'embed', label: 'Embed', hint: 'Ask the host to embed a URL', keywords: 'iframe video url', group: 'create' });
  }
  return extras;
}
