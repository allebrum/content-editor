/**
 * @allebrum/page-editor/renderer
 *
 * Read-only renderer — safe for server-side use (Next.js RSC, static gen, etc.)
 * Does NOT import Tiptap or any editor-only code.
 */

export { PageRenderer } from './components/PageRenderer';
export type { PageRendererProps } from './components/PageRenderer';

export { toHtml, sanitizeHtml, toPlainText, toMarkdown } from './serialization';

export type {
  EditorJsonDocument,
  Block,
  TextNode,
  EditorAsset,
} from './schema/types';
