export { BlockEditor } from './components/BlockEditor';
export type { BlockEditorProps } from './components/BlockEditor';
export { BlockRenderer } from './renderer';
export { SlashMenu } from './components/SlashMenu';
export { ShortcutsHelp } from './components/ShortcutsHelp';

export type {
  Block,
  BlockType,
  EditorDocument,
  HostAdapters,
  ExtraSlashCommand,
  HostActionId,
} from './types';
export { DOCUMENT_VERSION, PORTABLE_BLOCK_TYPES } from './types';
export { DocumentParseError } from './errors';
export type { DocumentErrorCode } from './errors';
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
export {
  reducer, blockId, emptyText, migrateBlocks, matchMarkdownShortcut,
  findSlashToken, removeSlashToken, pastedLines, fuzzyScore,
  isEditable, isList, isEmptyContent, EDITABLE_TYPES, LIST_TYPES,
} from './blocks';
export type { Action, MarkdownShortcut } from './blocks';
export { SLASH_COMMANDS, TURN_INTO_OPTIONS, extraCommandsFromAdapters } from './commands';
export type { CommandDef, SlashCommandId, SlashGroup } from './commands';
export {
  splitBlockPlan, mergePrevPlan, mergeNextPlan, markdownPlan, pasteLinesPlan, slashPickPlan,
} from './editing';
export { mergeBlocks, sameBlocks } from './merge';
export {
  selectedIds, extendSelection, pruneSelection, selectAll as selectAllBlocks,
  selectionFromEdge, blocksToPlainText, blocksToHtml, listNumbers,
} from './selection';
export type { BlockSelection } from './selection';
export { applyDraft, draftKey, saveDraft, takeDraft, DRAFT_TTL_MS } from './drafts';
export type { NotesDraft, DraftStorage } from './drafts';
export { buildNotesHelp, isHelpHotkey, MARKDOWN_HELP } from './help';
export { escapeHtml, sanitizeHref, isSafeHref } from './sanitize';
export { renderDocumentHtml, renderBlockHtml } from './render-html';

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
export { InlineContent, VideoEmbed } from './renderer';
export type { BlockRendererProps } from './renderer';
export { IMAGE_WIDTH_OPTIONS } from './components/BlockCanvas';
