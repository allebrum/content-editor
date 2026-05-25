/**
 * @allebrum/page-editor/server
 *
 * Server-safe utilities — no React, no browser APIs.
 * Use in Next.js API routes, server actions, Node scripts, build pipelines.
 */

export { toHtml } from './serialization/toHtml';
export { toPlainText } from './serialization/toPlainText';
export { toMarkdown } from './serialization/toMarkdown';
export { sanitizeHtml } from './serialization/sanitizeHtml';
export { extractTranslatableSegments, applyTranslations } from './serialization/extractTranslatableSegments';
export { migrateDocument } from './serialization/migrateDocument';
export { buildAssetManifest } from './utils/assets';
export { CURRENT_SCHEMA_VERSION } from './storage/types';

export type {
  EditorJsonDocument,
  StoredEditorDocument,
  Block,
  EditorAsset,
  EditorAssetManifest,
  TranslatableSegment,
  TranslationStatus,
  TranslationMap,
  EditorSaveResult,
  AiEditorRequest,
  AiEditorResponse,
  AiEditorAction,
} from './schema/types';
