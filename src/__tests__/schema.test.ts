import { describe, expect, it } from 'vitest';
import { DocumentParseError } from '../errors';
import { fromBlocks, parseDocument } from '../schema';

describe('parseDocument', () => {
  it('accepts a versioned portable document', () => {
    const doc = parseDocument({
      version: 1,
      blocks: [{ id: 'a', type: 'text', content: 'Hello' }],
    });
    expect(doc.version).toBe(1);
    expect(doc.blocks[0]?.content).toBe('Hello');
  });

  it('rejects TipTap / legacy page-builder documents without converting them', () => {
    expect(() => parseDocument({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })).toThrowError(DocumentParseError);
    try {
      parseDocument({ type: 'doc', content: [] });
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentParseError);
      expect((e as DocumentParseError).code).toBe('legacy_page_editor_document');
    }
  });

  it('rejects raw arrays so Hoppa SpaceBlock[] is not silently accepted', () => {
    try {
      parseDocument([{ id: 'a', type: 'text', content: 'x' }]);
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('unsupported_document');
    }
  });

  it('rejects Hoppa product block types instead of dropping them', () => {
    expect(() => parseDocument({
      version: 1,
      blocks: [{ id: 't1', type: 'todo', content: 'ship' }],
    })).toThrowError(/unsupported type/);
    try {
      parseDocument({ version: 1, blocks: [{ id: 't1', type: 'todo' }] });
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('unsupported_block_type');
    }
  });

  it('fromBlocks validates the same way', () => {
    const doc = fromBlocks([{ id: 'b', type: 'h1', content: 'Title' }]);
    expect(doc.blocks[0]?.type).toBe('h1');
    expect(() => fromBlocks([{ id: 'e', type: 'embed', embedUrl: 'https://x' }])).toThrowError(DocumentParseError);
  });
});
