import { PORTABLE_BLOCK_TYPES, DOCUMENT_VERSION, type Block, type BlockType, type EditorDocument } from './types';
import { DocumentParseError } from './errors';
import { emptyText } from './blocks';

export const MAX_BLOCKS = 2000;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_ID_LENGTH = 80;

const TYPE_SET = new Set<string>(PORTABLE_BLOCK_TYPES);

export function emptyDocument(): EditorDocument {
  return { version: DOCUMENT_VERSION, blocks: [emptyText()] };
}

export function isEditorDocument(value: unknown): value is EditorDocument {
  try {
    parseDocument(value);
    return true;
  } catch {
    return false;
  }
}

function isLegacyTipTapDoc(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  if (rec.type === 'doc') return true;
  // TipTap / ProseMirror documents also often include a content array of nodes
  // plus attrs, even if type is omitted in partial clones.
  if (Array.isArray(rec.content) && rec.content.some((n) => n && typeof n === 'object' && (n as { type?: unknown }).type === 'paragraph')) {
    return rec.version !== DOCUMENT_VERSION && !Array.isArray(rec.blocks);
  }
  return false;
}

function assertBlock(raw: unknown, index: number): Block {
  if (!raw || typeof raw !== 'object') {
    throw new DocumentParseError('invalid_document', `Block at index ${index} is not an object`);
  }
  const rec = raw as Record<string, unknown>;
  if (typeof rec.id !== 'string' || rec.id.length === 0 || rec.id.length > MAX_ID_LENGTH) {
    throw new DocumentParseError('invalid_document', `Block at index ${index} has an invalid id`);
  }
  if (typeof rec.type !== 'string') {
    throw new DocumentParseError('invalid_document', `Block ${rec.id} is missing a type`);
  }
  if (!TYPE_SET.has(rec.type)) {
    throw new DocumentParseError(
      'unsupported_block_type',
      `Block ${rec.id} has unsupported type "${rec.type}". Product types (todo, goal, timer, link, embed) and unknown types are not portable; the host must keep those outside this editor.`,
      { id: rec.id, type: rec.type },
    );
  }
  if (rec.content != null && typeof rec.content !== 'string') {
    throw new DocumentParseError('invalid_document', `Block ${rec.id} content must be a string`);
  }
  if (typeof rec.content === 'string' && rec.content.length > MAX_CONTENT_LENGTH) {
    throw new DocumentParseError('invalid_document', `Block ${rec.id} exceeds the ${MAX_CONTENT_LENGTH}-character content limit`);
  }
  if (rec.checked != null && typeof rec.checked !== 'boolean') {
    throw new DocumentParseError('invalid_document', `Block ${rec.id} checked must be a boolean`);
  }
  const block: Block = {
    id: rec.id,
    type: rec.type as BlockType,
    ...(typeof rec.content === 'string' ? { content: rec.content } : {}),
    ...(typeof rec.checked === 'boolean' ? { checked: rec.checked } : rec.type === 'checkbox' ? { checked: false } : {}),
  };
  return block;
}

/**
 * Parse a persisted document. Rejects the previous @allebrum/page-editor
 * TipTap `{ type: "doc" }` JSON without converting it (see MIGRATION.md).
 * Also rejects raw arrays and Hoppa product block types so data is never
 * silently dropped.
 */
export function parseDocument(value: unknown): EditorDocument {
  if (value == null) {
    throw new DocumentParseError('invalid_document', 'Document is empty');
  }
  if (Array.isArray(value)) {
    throw new DocumentParseError(
      'unsupported_document',
      'Raw block arrays are not accepted. Wrap validated blocks with fromBlocks() or persist { version: 1, blocks }. See MIGRATION.md.',
    );
  }
  if (isLegacyTipTapDoc(value)) {
    throw new DocumentParseError(
      'legacy_page_editor_document',
      'This looks like a TipTap / page-builder document from @allebrum/page-editor 0.1.x. Automatic conversion is not supported because it would risk silent data loss. See MIGRATION.md.',
    );
  }
  if (typeof value !== 'object') {
    throw new DocumentParseError('invalid_document', 'Document must be an object');
  }
  const rec = value as Record<string, unknown>;
  if (rec.version !== DOCUMENT_VERSION) {
    throw new DocumentParseError(
      'unsupported_document',
      `Unsupported document version ${String(rec.version)}. This package reads version ${DOCUMENT_VERSION} only.`,
    );
  }
  if (!Array.isArray(rec.blocks)) {
    throw new DocumentParseError('invalid_document', 'Document.blocks must be an array');
  }
  if (rec.blocks.length > MAX_BLOCKS) {
    throw new DocumentParseError('invalid_document', `Document exceeds the ${MAX_BLOCKS}-block limit`);
  }
  const blocks = rec.blocks.map((b, i) => assertBlock(b, i));
  if (blocks.length === 0) return emptyDocument();
  return { version: DOCUMENT_VERSION, blocks };
}

/** Validate and wrap an already-known block list. Throws on product / unknown types. */
export function fromBlocks(blocks: unknown[]): EditorDocument {
  if (blocks.length > MAX_BLOCKS) {
    throw new DocumentParseError('invalid_document', `Document exceeds the ${MAX_BLOCKS}-block limit`);
  }
  const parsed = blocks.map((b, i) => assertBlock(b, i));
  return { version: DOCUMENT_VERSION, blocks: parsed.length ? parsed : [emptyText()] };
}

export function validateDocument(value: unknown): EditorDocument {
  return parseDocument(value);
}

export function documentsEqual(a: EditorDocument, b: EditorDocument): boolean {
  if (a.version !== b.version || a.blocks.length !== b.blocks.length) return false;
  return a.blocks.every((block, i) => {
    const other = b.blocks[i]!;
    return (
      block.id === other.id &&
      block.type === other.type &&
      (block.content ?? '') === (other.content ?? '') &&
      Boolean(block.checked) === Boolean(other.checked)
    );
  });
}
