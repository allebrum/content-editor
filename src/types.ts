/** Portable block document types for @allebrum/page-editor. */

/**
 * Version written by default. Kept at 1 so existing hosts keep emitting and
 * storing v1 documents; opt into media blocks and inline marks with v2.
 */
export const DOCUMENT_VERSION = 1 as const;

/** Newest document version this package reads and (when asked) writes. */
export const LATEST_DOCUMENT_VERSION = 2 as const;

/** Every document version this package can read. */
export const SUPPORTED_DOCUMENT_VERSIONS = [1, 2] as const;
export type DocumentVersion = (typeof SUPPORTED_DOCUMENT_VERSIONS)[number];

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

/** Block types added in document version 2. Not valid in v1 documents. */
export const MEDIA_BLOCK_TYPES = ['image', 'video'] as const;
export type MediaBlockType = (typeof MEDIA_BLOCK_TYPES)[number];

export const VIDEO_PROVIDERS = ['vimeo', 'youtube'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

/** v2 image block. `src` is an http(s) URL or a same-origin path. */
export type ImageBlock = {
  id: string;
  type: 'image';
  src: string;
  /** Alternative text; empty string marks a decorative image. */
  alt: string;
  /** Preferred display width in CSS pixels (40–4000). Omitted = full width. */
  width?: number;
  caption?: string;
  /** Opaque host storage key (e.g. a Netlify Blobs key). Never rendered. */
  assetKey?: string;
};

/**
 * v2 video block. Embed-only: the document stores a provider and an id,
 * never a free-form URL or iframe, and renderers build the embed URL.
 */
export type VideoBlock = {
  id: string;
  type: 'video';
  provider: VideoProvider;
  videoId: string;
  /** Vimeo unlisted-video hash (the `h` parameter). */
  hash?: string;
  /** Accessible title for the iframe. */
  title?: string;
  caption?: string;
};

export type AnyBlockType = BlockType | MediaBlockType;

/**
 * Loose block shape used inside the editor for v1 and v2 documents. Every
 * `Block`, `ImageBlock`, and `VideoBlock` is assignable to it; narrow on
 * `type` before reading media fields.
 */
export type AnyBlock = {
  id: string;
  type: AnyBlockType;
  content?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
  width?: number;
  caption?: string;
  assetKey?: string;
  provider?: VideoProvider;
  videoId?: string;
  hash?: string;
  title?: string;
};

/**
 * Version 2 document. Adds `image` and `video` blocks, and block `content`
 * may carry inline marks: `**bold**`, `*italic*`, `` `code` ``,
 * `[label](https://…)`; a backslash escapes a marker. See MIGRATION.md.
 */
export type EditorDocumentV2 = {
  version: 2;
  blocks: Array<Block | ImageBlock | VideoBlock>;
};

export type AnyEditorDocument = EditorDocument | EditorDocumentV2;

export type ImageUploadResult = {
  src: string;
  width?: number;
  height?: number;
  assetKey?: string;
  alt?: string;
};

export type ImageUploadContext = {
  blockId: string;
  /** Report progress as a 0–1 fraction. */
  onProgress: (fraction: number) => void;
  /** Aborted when the user cancels or removes the pending block. */
  signal: AbortSignal;
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
  /**
   * v2 documents only: store one image and resolve its public URL. Enables
   * the Image slash item. Report progress through `ctx.onProgress`.
   */
  uploadImage?: (file: File, ctx: ImageUploadContext) => Promise<ImageUploadResult>;
};

export type ExtraSlashCommand = {
  id: string;
  label: string;
  hint: string;
  keywords?: string;
  run: (ctx: { blockId: string; content: string; caret: number }) => void;
};
