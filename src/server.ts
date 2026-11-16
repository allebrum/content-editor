/** Node-safe entry: schema, parsers, HTML renderer. No React, no DOM. */
export { DOCUMENT_VERSION, PORTABLE_BLOCK_TYPES } from './types';
export type { Block, BlockType, EditorDocument } from './types';
export { DocumentParseError } from './errors';
export {
  parseDocument,
  validateDocument,
  fromBlocks,
  emptyDocument,
  documentsEqual,
  MAX_BLOCKS,
  MAX_CONTENT_LENGTH,
  MAX_ID_LENGTH,
} from './schema';
export { renderDocumentHtml, renderBlockHtml } from './render-html';
export { escapeHtml, sanitizeHref, isSafeHref } from './sanitize';
export {
  reducer, blockId, emptyText, migrateBlocks, matchMarkdownShortcut,
  findSlashToken, removeSlashToken, pastedLines, fuzzyScore,
} from './blocks';
export type { Action, MarkdownShortcut } from './blocks';
export { mergeBlocks, sameBlocks } from './merge';
export { applyDraft, draftKey, saveDraft, takeDraft, DRAFT_TTL_MS } from './drafts';
export type { NotesDraft, DraftStorage } from './drafts';

// Version 2: media blocks and inline marks (additive; see MIGRATION.md).
export type {
  AnyBlock,
  AnyBlockType,
  AnyEditorDocument,
  DocumentVersion,
  EditorDocumentV2,
  ImageBlock,
  ImageUploadContext,
  ImageUploadResult,
  MediaBlockType,
  VideoBlock,
  VideoProvider,
} from './types';
export {
  LATEST_DOCUMENT_VERSION, SUPPORTED_DOCUMENT_VERSIONS, MEDIA_BLOCK_TYPES, VIDEO_PROVIDERS,
} from './types';
export {
  parseAnyDocument, migrateDocument, emptyDocumentV2, documentFromPlainText,
} from './schema';
export {
  parseInline, escapeInline, inlineToPlainText, inlineNodesToText, inlineNodesToHtml, renderInlineHtml,
  toggleInlineMark, LINK_REL,
} from './inline';
export type { InlineNode, InlineMark } from './inline';
export {
  parseVideoUrl, videoEmbedUrl, videoWatchUrl, sanitizeImageSrc, isValidVideoId, isValidVimeoHash,
  providerLabel, DEFAULT_VIDEO_PROVIDERS, VIDEO_IFRAME_ATTRS, MAX_URL_LENGTH, MAX_ALT_LENGTH,
  MAX_CAPTION_LENGTH, MIN_IMAGE_WIDTH, MAX_IMAGE_WIDTH,
} from './media';
export type { ParsedVideo } from './media';
export { renderAnyBlockHtml } from './render-html';
export type { RenderHtmlOptions } from './render-html';

// WYSIWYG inline marks content model (DOM-free).
export {
  richFromContent, serializeRich, canonicalContent, contentLength, sliceContent, joinContent,
  insertRich, insertContent, toggleRichMark, activeMarks, autoFormat,
} from './rich';
export type { Marks, RichChar, RichSegment } from './rich';
export { MARK_SEPARATOR } from './inline';
