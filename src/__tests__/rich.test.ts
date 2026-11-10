import { describe, expect, it } from 'vitest';
import {
  activeMarks, autoFormat, canonicalContent, contentLength, insertContent, insertRich, joinContent,
  richFromContent, richSegments, richText, serializeRich, sliceContent, toggleRichMark, type Marks, type RichChar,
} from '../rich';
import { inlineToPlainText, parseInline, renderInlineHtml } from '../inline';

const chars = (spec: [string, Marks][]): RichChar[] => spec.flatMap(([t, m]) => [...t].map((ch) => ({ ch, m })));
const segs = (content: string) => richSegments(richFromContent(content));

describe('serializeRich round-trip', () => {
  const cases: [string, [string, Marks][]][] = [
    ['plain', [['hello', {}]]],
    ['bold', [['a ', {}], ['b', { bold: true }], [' c', {}]]],
    ['italic after bold', [['x', { bold: true }], ['y', { italic: true }]]],
    ['bold after italic', [['y', { italic: true }], ['x', { bold: true }]]],
    ['bold inside italic at start', [['x', { italic: true, bold: true }], ['y', { italic: true }]]],
    ['bold inside italic at end', [['y', { italic: true }], ['x', { italic: true, bold: true }]]],
    ['overlap', [['a', { bold: true }], ['b', { bold: true, italic: true }], ['c', { italic: true }]]],
    ['code in bold', [['x ', { bold: true }], ['y', { bold: true, code: true }]]],
    ['link with bold', [['go ', { href: 'https://a.example/' }], ['now', { href: 'https://a.example/', bold: true }]]],
    ['two links', [['a', { href: 'https://a.example/' }], ['b', { href: 'https://b.example/' }]]],
    ['literal markers', [['2 * 3 = 6, a_b, `x`, [y](z) \\ done', {}]]],
    ['newline in bold', [['a\nb', { bold: true }]]],
    ['link with parens and spaces', [['wiki', { href: 'https://en.example/wiki/A_(b)' }]]],
  ];
  for (const [name, spec] of cases) {
    it(name, () => {
      const input = chars(spec);
      const out = serializeRich(input);
      expect(richSegments(richFromContent(out))).toEqual(richSegments(input));
      expect(serializeRich(richFromContent(out))).toBe(out);
    });
  }

  it('random documents round-trip', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const alphabet = 'ab *_`[]()\\\nxy';
    const hrefs = ['https://a.example/', 'https://b.example/x?y=1', '/learn'];
    for (let n = 0; n < 400; n++) {
      const input: RichChar[] = [];
      const len = 1 + Math.floor(rnd() * 14);
      let m: Marks = {};
      for (let i = 0; i < len; i++) {
        if (rnd() < 0.35) {
          m = {
            bold: rnd() < 0.4 || undefined, italic: rnd() < 0.4 || undefined,
            code: rnd() < 0.15 || undefined, href: rnd() < 0.2 ? hrefs[Math.floor(rnd() * hrefs.length)] : undefined,
          };
        }
        input.push({ ch: alphabet[Math.floor(rnd() * alphabet.length)]!, m });
      }
      const out = serializeRich(input);
      const back = richFromContent(out);
      // Same visible text always.
      expect(richText(back)).toBe(richText(input));
      // Canonical: serializing the parsed result is a fixed point.
      expect(serializeRich(back)).toBe(out);
      // Bold/italic/link survive except where whitespace was peeled.
      back.forEach((c, i) => {
        const o = input[i]!.m;
        expect(c.m.href ?? '').toBe(o.href ?? '');
        if (!/\s/.test(c.ch)) {
          expect(!!c.m.bold).toBe(!!o.bold);
          expect(!!c.m.italic).toBe(!!o.italic);
        }
      });
    }
  });

  it('moves edge whitespace outside bold', () => {
    expect(serializeRich(chars([['a', {}], [' b ', { bold: true }], ['c', {}]]))).toBe('a **b** c');
  });

  it('separates touching * markers with a word joiner the parser ignores', () => {
    const out = serializeRich(chars([['a', { italic: true }], ['b', { bold: true }]]));
    expect(out).toBe('*a*\u2060**b**');
    expect(inlineToPlainText(out)).toBe('ab');
    expect(renderInlineHtml(out)).toBe('<em>a</em><strong>b</strong>');
    expect(parseInline('x\u2060y')).toEqual([{ type: 'text', text: 'xy' }]);
  });
});

describe('content helpers', () => {
  it('slices and joins by visible offsets', () => {
    const c = 'one **two** three';
    expect(contentLength(c)).toBe(13);
    expect(sliceContent(c, 0, 6)).toBe('one **tw**');
    expect(sliceContent(c, 6)).toBe('**o** three');
    expect(joinContent(sliceContent(c, 0, 6), sliceContent(c, 6))).toBe(c);
    expect(joinContent('*a*', '*b*')).toBe('*ab*');
  });

  it('inserts typed text with the marks before the caret, literal markers escaped', () => {
    expect(insertRich('**ab**', 2, 2, 'c').content).toBe('**abc**');
    expect(insertRich('ab', 1, 1, '*', {}).content).toBe('a\\*b');
    expect(insertRich('ab', 2, 2, 'c', { italic: true })).toEqual({ content: 'ab*c*', caret: 3 });
    expect(insertContent('ab', 1, 1, '**x**')).toEqual({ content: 'a**x**b', caret: 2 });
  });

  it('reports active marks for a range and a caret', () => {
    expect(activeMarks('**ab**c', 0, 2)).toEqual({ bold: true });
    expect(activeMarks('**ab**c', 1, 3)).toEqual({});
    expect(activeMarks('**ab**c', 2, 2)).toEqual({ bold: true });
  });

  it('canonicalizes equivalent spellings', () => {
    expect(canonicalContent('_x_')).toBe('*x*');
    expect(canonicalContent('***x***')).toBe(canonicalContent('*\u2060**x**\u2060*'));
    expect(segs('**a** **b**')).toEqual([{ bold: true, text: 'a' }, { text: ' ' }, { bold: true, text: 'b' }]);
  });
});

describe('toggleRichMark', () => {
  it('adds, then removes, bold on a range', () => {
    const on = toggleRichMark('hello world', 0, 5, 'bold');
    expect(on).toEqual({ content: '**hello** world', start: 0, end: 5 });
    expect(toggleRichMark(on.content, 0, 5, 'bold').content).toBe('hello world');
  });
  it('adds a mark to a partly marked range', () => {
    expect(toggleRichMark('**he**llo', 0, 5, 'bold').content).toBe('**hello**');
  });
  it('nests italic inside bold', () => {
    expect(toggleRichMark('**hello**', 1, 4, 'italic').content).toBe('**h*ell*o**');
  });
  it('links a range and unlinks at the caret', () => {
    const linked = toggleRichMark('see docs', 4, 8, 'link', 'https://docs.example/');
    expect(linked.content).toBe('see [docs](https://docs.example/)');
    expect(toggleRichMark(linked.content, 6, 6, 'link').content).toBe('see docs');
  });
  it('inserts a linked address at a collapsed caret', () => {
    expect(toggleRichMark('go ', 3, 3, 'link', 'https://x.example/')).toEqual({
      content: 'go [https://x.example/](https://x.example/)', start: 3, end: 21,
    });
  });
  it('toggles code', () => {
    expect(toggleRichMark('run npm i', 4, 9, 'code').content).toBe('run `npm i`');
  });
});

describe('autoFormat', () => {
  const typed = (literal: string) => {
    // Content as the editor holds it after typing `literal`: every marker is a literal character.
    const content = insertRich('', 0, 0, literal, {}).content;
    return autoFormat(content, literal.length);
  };
  it('turns **text** into bold and drops the markers', () => {
    expect(typed('say **hi**')).toEqual({ content: 'say **hi**', caret: 6, applied: 'bold' });
    expect(inlineToPlainText(typed('say **hi**')!.content)).toBe('say hi');
  });
  it('waits for the second closing star', () => {
    expect(typed('say **hi*')).toBeNull();
  });
  it('handles italic, underscores, code and links', () => {
    expect(typed('a *b*')!.content).toBe('a *b*');
    expect(typed('a _b_')!.content).toBe('a *b*');
    expect(typed('a __b__')!.content).toBe('a **b**');
    expect(typed('run `ls`')!.content).toBe('run `ls`');
    expect(typed('[docs](https://d.example/)')).toEqual({ content: '[docs](https://d.example/)', caret: 4, applied: 'link' });
  });
  it('ignores snake_case, spaces inside markers, and unsafe links', () => {
    expect(typed('snake_case_')).toBeNull();
    expect(typed('a * b *')).toBeNull();
    expect(typed('[x](javascript:alert(1))')).toBeNull();
  });
  it('keeps other marks on the inner text', () => {
    const content = serializeRich(chars([['*', {}], ['b', { bold: true }], ['*', {}]]));
    expect(autoFormat(content, 3)!.content).toBe(serializeRich(chars([['b', { bold: true, italic: true }]])));
  });
});
