/** Portable block document types for @allebrum/page-editor. */

export const DOCUMENT_VERSION = 1 as const;

/** Block types this package renders and edits without a host adapter. */
export const PORTABLE_BLOCK_TYPES = [
  'text',
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'checkbox',
  'quote',
  'callout',
  'divider',
] as const;

export type BlockType = (typeof PORTABLE_BLOCK_TYPES)[number];

export type Block = {
  id: string;
  type: BlockType;
  content?: string;
  checked?: boolean;
};

export type EditorDocument = {
  version: typeof DOCUMENT_VERSION;
  blocks: Block[];
};

/** Host-supplied slash actions. Shown only when the host provides an adapter. */
export type HostActionId = 'mention' | 'upload' | 'embed';

export type HostAdapters = {
  /** Called with files the user pasted or picked via the Upload slash item. */
  upload?: (files: File[], ctx: { blockId: string }) => void | Promise<void>;
  /** Called after the Mention slash item (or when the host opens mention UI). */
  mention?: (ctx: { blockId: string; caret: number; query: string }) => void;
  /** Called after the Embed slash item. The host owns URL collection and storage. */
  embed?: (ctx: { blockId: string }) => void;
};

export type ExtraSlashCommand = {
  id: string;
  label: string;
  hint: string;
  keywords?: string;
  run: (ctx: { blockId: string; content: string; caret: number }) => void;
};
