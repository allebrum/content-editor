import { describe, expect, it } from 'vitest';
import {
  escapeInline, inlineToPlainText, parseInline, renderInlineHtml, toggleInlineMark,
} from '../inline';

describe('parseInline', () => {
  it('parses bold, italic, code and links', () => {
    expect(parseInline('a **b** *c* _d_ `e` [f](https://x.org)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'd' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'e' },
      { type: 'text', text: ' ' },
      { type: 'link', href: 'https://x.org/', children: [{ type: 'text', text: 'f' }] },
    ]);
  });

  it('nests marks inside bold and links', () => {
    expect(parseInline('**a *b***')).toEqual([
      { type: 'bold', children: [{ type: 'text', text: 'a ' }, { type: 'italic', children: [{ type: 'text', text: 'b' }] }] },
    ]);
    expect(parseInline('[**x**](/help)')).toEqual([
      { type: 'link', href: '/help', children: [{ type: 'bold', children: [{ type: 'text', text: 'x' }] }] },
    ]);
  });

  it('leaves unmatched, spaced, intraword and escaped markers literal', () => {
    expect(inlineToPlainText('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(parseInline('snake_case_name')).toEqual([{ type: 'text', text: 'snake_case_name' }]);
    expect(parseInline('\\*not\\* \\[x\\]')).toEqual([{ type: 'text', text: '*not* [x]' }]);
    expect(parseInline('**open')).toEqual([{ type: 'text', text: '**open' }]);
  });

  it('drops unsafe link targets but keeps the label text', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ type: 'text', text: 'click' }]);
    expect(renderInlineHtml('[x](data:text/html,hi)')).toBe('x');
    expect(renderInlineHtml('[x](//evil.example)')).toBe('x');
  });

  it('renders sanitized HTML and never passes raw HTML through', () => {
    expect(renderInlineHtml('<b>hi</b> **<i>**')).toBe('&lt;b&gt;hi&lt;/b&gt; <strong>&lt;i&gt;</strong>');
    expect(renderInlineHtml('[a](https://x.org?q="1")')).toBe('a');
    expect(renderInlineHtml('[w](https://en.wikipedia.org/wiki/A_(b))')).toBe(
      '<a href="https://en.wikipedia.org/wiki/A_(b)" target="_blank" rel="noopener noreferrer nofollow">w</a>',
    );
    expect(renderInlineHtml('[a](https://x.org)')).toBe(
      '<a href="https://x.org/" target="_blank" rel="noopener noreferrer nofollow">a</a>',
    );
    expect(renderInlineHtml('[a](/local)')).toBe('<a href="/local">a</a>');
    expect(renderInlineHtml('`<x>`')).toBe('<code>&lt;x&gt;</code>');
  });

  it('escapeInline round-trips any text literally', () => {
    for (const s of ['2 * 3', '**not bold**', 'a_b_c', '[x](y)', 'back\\slash', '`tick`']) {
      expect(inlineToPlainText(escapeInline(s))).toBe(s);
    }
  });
});

describe('toggleInlineMark', () => {
  it('wraps and unwraps a selection', () => {
    const on = toggleInlineMark('hello world', 6, 11, 'bold');
    expect(on).toEqual({ content: 'hello **world**', start: 8, end: 13 });
    expect(toggleInlineMark(on.content, on.start, on.end, 'bold')).toEqual({ content: 'hello world', start: 6, end: 11 });
    expect(toggleInlineMark('a b', 2, 3, 'code').content).toBe('a `b`');
    expect(toggleInlineMark('a b', 2, 3, 'italic').content).toBe('a *b*');
  });

  it('inserts links, using the URL as the label for an empty selection', () => {
    expect(toggleInlineMark('see docs', 4, 8, 'link', 'https://x.org').content).toBe('see [docs](https://x.org)');
    expect(toggleInlineMark('go ', 3, 3, 'link', '/a').content).toBe('go [/a](/a)');
    expect(toggleInlineMark('go', 0, 2, 'link', '').content).toBe('go');
  });
});
