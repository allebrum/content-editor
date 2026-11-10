import { describe, expect, it } from 'vitest';
import { blocksToHtml, blocksToPlainText } from '../selection';

describe('v2 block copy', () => {
  it('copies formatted text, not stored markers', () => {
    const blocks = [{ id: 'a', type: 'h1' as const, content: 'A **bold** idea' }, { id: 'b', type: 'text' as const, content: '\\*literal\\*' }];
    expect(blocksToPlainText(blocks, undefined, { inlineMarks: true })).toBe('# A bold idea\n*literal*');
    expect(blocksToHtml(blocks, undefined, { inlineMarks: true })).toBe('<h1>A <strong>bold</strong> idea</h1><p>*literal*</p>');
    expect(blocksToPlainText(blocks)).toBe('# A **bold** idea\n\\*literal\\*');
  });
});
