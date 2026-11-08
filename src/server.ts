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
