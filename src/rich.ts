/**
 * WYSIWYG editing model for version 2 inline marks.
 *
 * The stored format is unchanged: block `content` is the markdown-like string
 * described in `inline.ts`. While editing, the canvas shows formatted text and
 * works in *plain-text offsets* (what the reader sees). This module converts
 * between the two: a content string ⇄ a list of characters with marks.
 *
 * `serializeRich()` is canonical: it always produces content that parses back
 * to the same marks (whitespace at the edge of bold/italic moves outside the
 * mark, and a U+2060 separator splits `*` markers that would touch).
 *
 * DOM-free and React-free.
 */
import { escapeInline, MARK_SEPARATOR, parseInline, type InlineMark, type InlineNode } from './inline';
import { sanitizeHref } from './sanitize';

export type Marks = { bold?: boolean; italic?: boolean; code?: boolean; href?: string };
export type RichSegment = Marks & { text: string };
/** One entry per UTF-16 code unit, so offsets match DOM text offsets. */
export type RichChar = { ch: string; m: Marks };

const NO_MARKS: Marks = Object.freeze({});

export function cleanMarks(m: Marks): Marks {
  const out: Marks = {};
  if (m.bold) out.bold = true;
  if (m.italic) out.italic = true;
  if (m.code) out.code = true;
  if (m.href) out.href = m.href;
  return out;
}

export function sameMarks(a: Marks, b: Marks): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.code === !!b.code && (a.href ?? '') === (b.href ?? '');
}

function pushChars(out: RichChar[], text: string, m: Marks) {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === MARK_SEPARATOR || ch === '\u200B') continue;
    out.push({ ch, m });
  }
}

function nodesToChars(nodes: InlineNode[], m: Marks, out: RichChar[]) {
  for (const n of nodes) {
    switch (n.type) {
      case 'text': pushChars(out, n.text, m); break;
      case 'code': pushChars(out, n.text, cleanMarks({ ...m, code: true })); break;
      case 'bold': nodesToChars(n.children, cleanMarks({ ...m, bold: true }), out); break;
      case 'italic': nodesToChars(n.children, cleanMarks({ ...m, italic: true }), out); break;
      case 'link': nodesToChars(n.children, cleanMarks({ ...m, href: n.href }), out); break;
    }
  }
}

/** Parse stored v2 content into marked characters. */
export function richFromContent(content: string | null | undefined): RichChar[] {
  const out: RichChar[] = [];
  nodesToChars(parseInline(content), NO_MARKS, out);
  return out;
}

export function richText(chars: readonly RichChar[]): string {
  let s = '';
  for (const c of chars) s += c.ch;
  return s;
}

export function richSegments(chars: readonly RichChar[]): RichSegment[] {
  const out: RichSegment[] = [];
  for (const c of chars) {
    const last = out[out.length - 1];
    if (last && sameMarks(last, c.m)) last.text += c.ch;
    else out.push({ ...cleanMarks(c.m), text: c.ch });
  }
  return out;
}

export function richFromSegments(segs: readonly RichSegment[]): RichChar[] {
  const out: RichChar[] = [];
  for (const s of segs) pushChars(out, s.text, cleanMarks(s));
  return out;
}

const WS = /\s/;

/** Move whitespace at the edges of bold/italic runs outside the mark (markers can't touch spaces). */
function peelWhitespace(chars: RichChar[]): RichChar[] {
  const out = chars.map((c) => ({ ch: c.ch, m: c.m }));
  for (const key of ['bold', 'italic'] as const) {
    let i = 0;
    while (i < out.length) {
      if (!out[i]!.m[key]) { i++; continue; }
      let j = i;
      while (j < out.length && out[j]!.m[key]) j++;
      let a = i;
      let b = j - 1;
      while (a <= b && WS.test(out[a]!.ch)) a++;
      while (b >= a && WS.test(out[b]!.ch)) b--;
      for (let k = i; k < j; k++) {
        if (k < a || k > b) out[k] = { ch: out[k]!.ch, m: cleanMarks({ ...out[k]!.m, [key]: false }) };
      }
      i = j;
    }
  }
  return out;
}

type Tok = { t: 'text'; s: string } | { t: 'delim'; s: string };
type Key = 'link' | 'bold' | 'italic';

function runLength(segs: RichSegment[], k: number, key: Key, href: string | undefined): number {
  let j = k;
  while (j < segs.length) {
    const s = segs[j]!;
    if (key === 'link' ? s.href !== href : !s[key]) break;
    j++;
  }
  return j - k;
}

/** Percent-encode characters the link syntax can't hold inside `( )`. */
function linkTarget(href: string): string {
  const enc = (c: string) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
  let depth = 0;
  let balanced = true;
  for (const ch of href) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) balanced = false;
  }
  const safe = href.replace(/[\s"<>]/g, enc);
  return balanced && depth === 0 ? safe : safe.replace(/[()]/g, enc);
}

function leaf(s: RichSegment, open: ReadonlySet<Key>, out: Tok[]) {
  const text = s.text;
  if (!text) return;
  const codeOk = s.code && !text.includes('`')
    && !((open.has('bold') || open.has('italic')) && text.includes('*'))
    && !(open.has('link') && /[[\]]/.test(text));
  if (codeOk) {
    out.push({ t: 'delim', s: '`' }, { t: 'text', s: text }, { t: 'delim', s: '`' });
  } else {
    out.push({ t: 'text', s: escapeInline(text) });
  }
}

function emit(segs: RichSegment[], open: ReadonlySet<Key>, out: Tok[]) {
  let k = 0;
  while (k < segs.length) {
    const s = segs[k]!;
    const cands: Key[] = [];
    if (s.href && !open.has('link')) cands.push('link');
    if (s.bold && !open.has('bold')) cands.push('bold');
    if (s.italic && !open.has('italic')) cands.push('italic');
    if (cands.length === 0) {
      leaf(s, open, out);
      k++;
      continue;
    }
    let best = cands[0]!;
    let bestLen = 0;
    for (const c of cands) {
      const len = runLength(segs, k, c, s.href);
      if (len > bestLen) { best = c; bestLen = len; }
    }
    const inner = new Set(open);
    inner.add(best);
    const run = segs.slice(k, k + bestLen);
    if (best !== 'link') {
      // Markers can't sit next to whitespace: emit edge whitespace outside this mark.
      const rc = richFromSegments(run);
      let a = 0;
      let b = rc.length;
      while (a < b && WS.test(rc[a]!.ch)) a++;
      while (b > a && WS.test(rc[b - 1]!.ch)) b--;
      if (a > 0 || b < rc.length) {
        const strip = (cs: RichChar[]) => richSegments(cs.map((c) => ({ ch: c.ch, m: cleanMarks({ ...c.m, [best]: false }) })));
        emit(strip(rc.slice(0, a)), open, out);
        if (b > a) {
          const m = best === 'bold' ? '**' : '*';
          out.push({ t: 'delim', s: m });
          emit(richSegments(rc.slice(a, b)), inner, out);
          out.push({ t: 'delim', s: m });
        }
        emit(strip(rc.slice(b)), open, out);
        k += bestLen;
        continue;
      }
    }
    if (best === 'link') {
      out.push({ t: 'delim', s: '[' });
      emit(run, inner, out);
      out.push({ t: 'delim', s: `](${linkTarget(s.href!)})` });
    } else {
      const m = best === 'bold' ? '**' : '*';
      out.push({ t: 'delim', s: m });
      emit(run, inner, out);
      out.push({ t: 'delim', s: m });
    }
    k += bestLen;
  }
}

/** Canonical v2 content for marked characters. Round-trips through `richFromContent()`. */
export function serializeRich(chars: readonly RichChar[]): string {
  const segs = richSegments(peelWhitespace(chars as RichChar[]));
  const toks: Tok[] = [];
  emit(segs, new Set(), toks);
  let out = '';
  let prev: Tok | null = null;
  for (const tok of toks) {
    if (prev && prev.t === 'delim' && tok.t === 'delim' && prev.s.endsWith('*') && tok.s.startsWith('*')) out += MARK_SEPARATOR;
    out += tok.s;
    prev = tok;
  }
  return out;
}

/** Canonical form of stored content (same marks, normalized markers). */
export function canonicalContent(content: string | null | undefined): string {
  return serializeRich(richFromContent(content));
}

/** Visible length of v2 content (caret offsets count these characters). */
export function contentLength(content: string | null | undefined): number {
  return richFromContent(content).length;
}

/** Content of the visible range `start`–`end`, marks kept. */
export function sliceContent(content: string | null | undefined, start: number, end?: number): string {
  return serializeRich(richFromContent(content).slice(start, end));
}

/** Join v2 content strings without markers bleeding across the seam. */
export function joinContent(...parts: (string | null | undefined)[]): string {
  const all: RichChar[] = [];
  for (const p of parts) all.push(...richFromContent(p));
  return serializeRich(all);
}

/** Marks a character typed at `offset` would get: those of the character before it (or after, at 0). */
export function marksAt(chars: readonly RichChar[], offset: number): Marks {
  const c = offset > 0 ? chars[offset - 1] : chars[0];
  if (!c) return NO_MARKS;
  // Links don't extend past their end when typing.
  if (c.m.href && offset > 0 && (offset >= chars.length || chars[offset]!.m.href !== c.m.href)) {
    return cleanMarks({ ...c.m, href: undefined });
  }
  return c.m;
}

/** Marks shared by every character in `start`–`end` (or the typing marks at a caret). */
export function activeMarks(content: string | null | undefined, start: number, end: number): Marks {
  const chars = richFromContent(content);
  if (start === end) {
    const c = start > 0 ? chars[start - 1] : chars[0];
    return c ? c.m : NO_MARKS;
  }
  const range = chars.slice(Math.min(start, end), Math.max(start, end));
  if (!range.length) return NO_MARKS;
  const first = range[0]!.m;
  return cleanMarks({
    bold: range.every((c) => c.m.bold),
    italic: range.every((c) => c.m.italic),
    code: range.every((c) => c.m.code),
    href: first.href && range.every((c) => c.m.href === first.href) ? first.href : undefined,
  });
}

/** Replace the visible range `start`–`end` with `text` carrying `marks`. */
export function insertRich(
  content: string | null | undefined,
  start: number,
  end: number,
  text: string,
  marks?: Marks,
): { content: string; caret: number } {
  const chars = richFromContent(content);
  const a = Math.max(0, Math.min(start, end, chars.length));
  const b = Math.min(chars.length, Math.max(start, end));
  const m = cleanMarks(marks ?? marksAt(chars, a));
  const ins: RichChar[] = [];
  pushChars(ins, text, m);
  return { content: serializeRich([...chars.slice(0, a), ...ins, ...chars.slice(b)]), caret: a + ins.length };
}

/** Replace `start`–`end` with already-serialized v2 content (paste). */
export function insertContent(
  content: string | null | undefined,
  start: number,
  end: number,
  inserted: string,
): { content: string; caret: number } {
  const chars = richFromContent(content);
  const a = Math.max(0, Math.min(start, end, chars.length));
  const b = Math.min(chars.length, Math.max(start, end));
  const ins = richFromContent(inserted);
  return { content: serializeRich([...chars.slice(0, a), ...ins, ...chars.slice(b)]), caret: a + ins.length };
}

/** Toggle typing marks at a collapsed caret (Ctrl/⌘+B with nothing selected). */
export function toggleMarks(m: Marks, mark: Exclude<InlineMark, 'link'>): Marks {
  return cleanMarks({ ...m, [mark]: !m[mark] });
}

/**
 * Toggle `mark` on the visible range `start`–`end`: removed when every
 * character already has it, added otherwise. For `link`, pass `href` to set
 * a link, or omit it to remove links. A collapsed range inserts the link
 * address as linked text. Offsets in the result are visible offsets.
 */
export function toggleRichMark(
  content: string | null | undefined,
  start: number,
  end: number,
  mark: InlineMark,
  href?: string,
): { content: string; start: number; end: number } {
  const chars = richFromContent(content);
  const a = Math.max(0, Math.min(start, end, chars.length));
  const b = Math.min(chars.length, Math.max(start, end));
  if (mark === 'link') {
    if (a === b) {
      if (!href) {
        // Caret inside a link: unlink the whole link.
        const at = chars[a - 1]?.m.href ? a - 1 : chars[a]?.m.href ? a : -1;
        if (at === -1) return { content: serializeRich(chars), start: a, end: b };
        const h = chars[at]!.m.href;
        let s = at;
        let e = at;
        while (s > 0 && chars[s - 1]!.m.href === h) s--;
        while (e < chars.length && chars[e]!.m.href === h) e++;
        const next = chars.map((c, i) => (i >= s && i < e ? { ch: c.ch, m: cleanMarks({ ...c.m, href: undefined }) } : c));
        return { content: serializeRich(next), start: a, end: b };
      }
      const ins: RichChar[] = [];
      pushChars(ins, href, cleanMarks({ ...marksAt(chars, a), code: false, href }));
      return { content: serializeRich([...chars.slice(0, a), ...ins, ...chars.slice(a)]), start: a, end: a + ins.length };
    }
    const next = chars.map((c, i) => (i >= a && i < b ? { ch: c.ch, m: cleanMarks({ ...c.m, href }) } : c));
    return { content: serializeRich(next), start: a, end: b };
  }
  if (a === b) return { content: serializeRich(chars), start: a, end: b };
  const all = chars.slice(a, b).every((c) => c.m[mark]);
  const next = chars.map((c, i) => (i >= a && i < b ? { ch: c.ch, m: cleanMarks({ ...c.m, [mark]: !all }) } : c));
  return { content: serializeRich(next), start: a, end: b };
}

/** Apply `marks` to a visible range (IME text composed while typing marks were on). */
export function applyMarksToRange(content: string | null | undefined, start: number, end: number, marks: Marks): string {
  const chars = richFromContent(content);
  const m = cleanMarks(marks);
  return serializeRich(chars.map((c, i) => (i >= start && i < end ? { ch: c.ch, m } : c)));
}

/** Characters that can finish a markdown-style inline shortcut. */
export const AUTOFORMAT_TRIGGERS = new Set(['*', '_', '`', ')']);

type AutoRule = {
  re: RegExp;
  apply: (m: RegExpExecArray) => { open: number; close: number; marks: Marks; href?: string } | null;
};

const AUTO_RULES: AutoRule[] = [
  // **bold** and __bold__
  { re: /(?:^|[^*\\])(\*\*)([^*\s](?:[^*]*?[^*\s])?)\*\*$/, apply: () => ({ open: 2, close: 2, marks: { bold: true } }) },
  { re: /(?:^|[^_\\\p{L}\p{N}])(__)([^_\s](?:[^_]*?[^_\s])?)__$/u, apply: () => ({ open: 2, close: 2, marks: { bold: true } }) },
  // *italic* and _italic_
  { re: /(?:^|[^*\\])(\*)([^*\s](?:[^*]*?[^*\s])?)\*$/, apply: () => ({ open: 1, close: 1, marks: { italic: true } }) },
  { re: /(?:^|[^_\\\p{L}\p{N}])(_)([^_\s](?:[^_]*?[^_\s])?)_$/u, apply: () => ({ open: 1, close: 1, marks: { italic: true } }) },
  // `code`
  { re: /(?:^|[^`\\])(`)([^`]+)`$/, apply: () => ({ open: 1, close: 1, marks: { code: true } }) },
  // [label](https://…)
  {
    re: /(\[)([^\]\n]+)\]\(([^()\s]+)\)$/,
    apply: (m) => {
      const href = sanitizeHref(m[3]);
      return href ? { open: 1, close: 3 + m[3]!.length, marks: {}, href } : null;
    },
  },
];

/**
 * Markdown-style inline shortcuts while typing: when the character just
 * typed closes `**text**`, `*text*`, `_text_`, `` `text` `` or `[text](url)`,
 * remove the typed markers and apply the mark. `caret` is the visible offset
 * right after the typed character. Returns null when nothing matches.
 */
export function autoFormat(
  content: string | null | undefined,
  caret: number,
): { content: string; caret: number; applied: InlineMark } | null {
  const chars = richFromContent(content);
  if (caret <= 0 || caret > chars.length) return null;
  if (!AUTOFORMAT_TRIGGERS.has(chars[caret - 1]!.ch)) return null;
  const before = richText(chars.slice(0, caret));
  for (const rule of AUTO_RULES) {
    const m = rule.re.exec(before);
    if (!m) continue;
    const plan = rule.apply(m);
    if (!plan) continue;
    const start = before.length - m[0].length + m[0].indexOf(m[1]!);
    const innerStart = start + plan.open;
    const innerEnd = before.length - plan.close;
    if (innerEnd <= innerStart) continue;
    // Markers typed inside code (or the inner text already code, for `code`) stay literal.
    const markerIdx = [...range(start, innerStart), ...range(innerEnd, before.length)];
    if (markerIdx.some((i) => chars[i]!.m.code)) continue;
    const inner = chars.slice(innerStart, innerEnd).map((c) => ({
      ch: c.ch,
      m: cleanMarks({
        ...c.m,
        ...(plan.marks.bold ? { bold: true } : {}),
        ...(plan.marks.italic ? { italic: true } : {}),
        ...(plan.marks.code ? { code: true } : {}),
        ...(plan.href ? { href: plan.href } : {}),
      }),
    }));
    const next = [...chars.slice(0, start), ...inner, ...chars.slice(caret)];
    const applied: InlineMark = plan.href ? 'link' : plan.marks.bold ? 'bold' : plan.marks.italic ? 'italic' : 'code';
    return { content: serializeRich(next), caret: start + inner.length, applied };
  }
  return null;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i < b; i++) out.push(i);
  return out;
}
