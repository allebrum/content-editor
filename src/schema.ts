import {
  PORTABLE_BLOCK_TYPES, DOCUMENT_VERSION, LATEST_DOCUMENT_VERSION, MEDIA_BLOCK_TYPES, VIDEO_PROVIDERS,
  type AnyBlock, type AnyEditorDocument, type Block, type BlockType, type DocumentVersion,
  type EditorDocument, type EditorDocumentV2, type ImageBlock, type VideoBlock, type VideoProvider,
} from './types';
import { DocumentParseError } from './errors';
import { emptyText } from './blocks';
import { escapeInline } from './inline';
import {
  MAX_ALT_LENGTH, MAX_CAPTION_LENGTH, MAX_IMAGE_WIDTH, MAX_URL_LENGTH, MIN_IMAGE_WIDTH,
  isValidVideoId, isValidVimeoHash, sanitizeImageSrc,
} from './media';

export const MAX_BLOCKS = 2000;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_ID_LENGTH = 80;

const TYPE_SET = new Set<string>(PORTABLE_BLOCK_TYPES);
const MEDIA_SET = new Set<string>(MEDIA_BLOCK_TYPES);
const PROVIDER_SET = new Set<string>(VIDEO_PROVIDERS);

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

function optionalString(rec: Record<string, unknown>, key: string, max: number, id: string): string | undefined {
  const v = rec[key];
  if (v == null) return undefined;
  if (typeof v !== 'string') throw new DocumentParseError('invalid_document', `Block ${id} ${key} must be a string`);
  if (v.length > max) throw new DocumentParseError('invalid_document', `Block ${id} ${key} exceeds ${max} characters`);
  return v;
}

function assertMediaBlock(rec: Record<string, unknown>, id: string): ImageBlock | VideoBlock {
  const caption = optionalString(rec, 'caption', MAX_CAPTION_LENGTH, id);
  if (rec.type === 'image') {
    const src = typeof rec.src === 'string' ? sanitizeImageSrc(rec.src) : null;
    if (!src) throw new DocumentParseError('invalid_document', `Image block ${id} needs an http(s) or same-origin src`);
    const alt = optionalString(rec, 'alt', MAX_ALT_LENGTH, id) ?? '';
    let width: number | undefined;
    if (rec.width != null) {
      if (typeof rec.width !== 'number' || !Number.isInteger(rec.width) || rec.width < MIN_IMAGE_WIDTH || rec.width > MAX_IMAGE_WIDTH) {
        throw new DocumentParseError('invalid_document', `Image block ${id} width must be an integer from ${MIN_IMAGE_WIDTH} to ${MAX_IMAGE_WIDTH}`);
      }
      width = rec.width;
    }
    const assetKey = optionalString(rec, 'assetKey', MAX_URL_LENGTH, id);
    return {
      id, type: 'image', src, alt,
      ...(width != null ? { width } : {}),
      ...(caption ? { caption } : {}),
      ...(assetKey ? { assetKey } : {}),
    };
  }
  const provider = rec.provider;
  if (typeof provider !== 'string' || !PROVIDER_SET.has(provider)) {
    throw new DocumentParseError('invalid_document', `Video block ${id} provider must be one of ${VIDEO_PROVIDERS.join(', ')}`);
  }
  if (typeof rec.videoId !== 'string' || !isValidVideoId(provider as VideoProvider, rec.videoId)) {
    throw new DocumentParseError('invalid_document', `Video block ${id} has an invalid ${provider} id`);
  }
  let hash: string | undefined;
  if (rec.hash != null) {
    if (provider !== 'vimeo' || typeof rec.hash !== 'string' || !isValidVimeoHash(rec.hash)) {
      throw new DocumentParseError('invalid_document', `Video block ${id} has an invalid hash`);
    }
    hash = rec.hash;
  }
  const title = optionalString(rec, 'title', MAX_ALT_LENGTH, id);
  return {
    id, type: 'video', provider: provider as VideoProvider, videoId: rec.videoId,
    ...(hash ? { hash } : {}),
    ...(title ? { title } : {}),
    ...(caption ? { caption } : {}),
  };
}

function assertBlock(raw: unknown, index: number): Block;
function assertBlock(raw: unknown, index: number, version: DocumentVersion): AnyBlock;
function assertBlock(raw: unknown, index: number, version: DocumentVersion = 1): AnyBlock {
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
  if (version >= 2 && MEDIA_SET.has(rec.type)) return assertMediaBlock(rec, rec.id);
  if (!TYPE_SET.has(rec.type)) {
    if (MEDIA_SET.has(rec.type)) {
      throw new DocumentParseError(
        'unsupported_block_type',
        `Block ${rec.id} has type "${rec.type}", which needs a version 2 document. Use migrateDocument() and parseAnyDocument().`,
        { id: rec.id, type: rec.type },
      );
    }
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

function readEnvelope(value: unknown): { version: unknown; blocks: unknown[] } {
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
  return { version: rec.version, blocks: rec.blocks as unknown[] };
}

function readBlocks(raw: unknown, version: DocumentVersion): AnyBlock[] {
  if (!Array.isArray(raw)) {
    throw new DocumentParseError('invalid_document', 'Document.blocks must be an array');
  }
  if (raw.length > MAX_BLOCKS) {
    throw new DocumentParseError('invalid_document', `Document exceeds the ${MAX_BLOCKS}-block limit`);
  }
  return raw.map((b, i) => assertBlock(b, i, version));
}

/**
 * Parse a persisted version 1 document. Rejects the previous
 * @allebrum/page-editor TipTap `{ type: "doc" }` JSON without converting it
 * (see MIGRATION.md). Also rejects raw arrays and Hoppa product block types
 * so data is never silently dropped.
 *
 * Version 2 documents are rejected here so existing hosts keep a v1-only
 * contract; use `parseAnyDocument()` to read v1 and v2.
 */
export function parseDocument(value: unknown): EditorDocument {
  const env = readEnvelope(value);
  if (env.version !== DOCUMENT_VERSION) {
    throw new DocumentParseError(
      'unsupported_document',
      env.version === LATEST_DOCUMENT_VERSION
        ? 'This is a version 2 document (media blocks and inline marks). parseDocument() reads version 1 only; use parseAnyDocument().'
        : `Unsupported document version ${String(env.version)}. This package reads version ${DOCUMENT_VERSION} only.`,
    );
  }
  const blocks = readBlocks(env.blocks, 1) as Block[];
  if (blocks.length === 0) return emptyDocument();
  return { version: DOCUMENT_VERSION, blocks };
}

/** Parse a version 1 or version 2 document. v1 input is returned as v1 (not migrated). */
export function parseAnyDocument(value: unknown): AnyEditorDocument {
  const env = readEnvelope(value);
  if (env.version === DOCUMENT_VERSION) return parseDocument(value);
  if (env.version !== LATEST_DOCUMENT_VERSION) {
    throw new DocumentParseError(
      'unsupported_document',
      `Unsupported document version ${String(env.version)}. This package reads versions 1 and 2.`,
    );
  }
  const blocks = readBlocks(env.blocks, 2) as EditorDocumentV2['blocks'];
  return { version: 2, blocks: blocks.length ? blocks : [emptyText() as Block] };
}

export function emptyDocumentV2(): EditorDocumentV2 {
  return { version: 2, blocks: [emptyText() as Block] };
}

/**
 * Upgrade a document to version 2. v1 block text is escaped so characters
 * such as `*` or `[` keep rendering literally. Idempotent for v2 input.
 * Accepts unparsed JSON and validates it first.
 */
export function migrateDocument(value: unknown): EditorDocumentV2 {
  const doc = parseAnyDocument(value);
  if (doc.version === 2) return doc;
  return {
    version: 2,
    blocks: doc.blocks.map((b) => (b.content ? { ...b, content: escapeInline(b.content) } : { ...b })),
  };
}

/** Wrap one plain-text string (e.g. a legacy text field) as a document. One block per line. */
export function documentFromPlainText(text: string, version: 1): EditorDocument;
export function documentFromPlainText(text: string, version?: 2): EditorDocumentV2;
export function documentFromPlainText(text: string, version: DocumentVersion = 2): AnyEditorDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const blocks: Block[] = lines.map((line) => ({
    ...emptyText(),
    content: (version === 2 ? escapeInline(line) : line).slice(0, MAX_CONTENT_LENGTH),
  }));
  return version === 2 ? { version: 2, blocks } : { version: 1, blocks };
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

const MEDIA_FIELDS = ['src', 'alt', 'width', 'caption', 'assetKey', 'provider', 'videoId', 'hash', 'title'] as const;

export function documentsEqual(
  a: EditorDocument | AnyEditorDocument | { version: DocumentVersion; blocks: AnyBlock[] },
  b: EditorDocument | AnyEditorDocument | { version: DocumentVersion; blocks: AnyBlock[] },
): boolean {
  if (a.version !== b.version || a.blocks.length !== b.blocks.length) return false;
  return a.blocks.every((x, i) => {
    const block = x as AnyBlock;
    const other = b.blocks[i]! as AnyBlock;
    return (
      block.id === other.id &&
      block.type === other.type &&
      (block.content ?? '') === (other.content ?? '') &&
      Boolean(block.checked) === Boolean(other.checked) &&
      MEDIA_FIELDS.every((k) => (block[k] ?? null) === (other[k] ?? null))
    );
  });
}
