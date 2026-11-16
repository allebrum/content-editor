/**
 * Inline marks for version 2 documents.
 *
 * Block `content` stays a plain string. In v2 it may carry a small,
 * markdown-like subset: `**bold**`, `*italic*` or `_italic_`, `` `code` ``,
 * and `[label](href)`. A backslash escapes the next marker character. v1
 * content is always literal; `migrateDocument()` escapes it so it renders
 * the same after the upgrade.
 *
 * U+2060 WORD JOINER is a zero-width separator between adjacent markers
 * (`*a*\u2060**b**`); it is never part of the text. The editor's serializer
 * inserts it only where two `*` markers would otherwise touch.
 *
 * DOM-free and React-free so servers and React Native hosts can share it.
 */
import { escapeHtml, sanitizeHref } from './sanitize';

export type InlineMark = 'bold' | 'italic' | 'code' | 'link';

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] };

const ESCAPABLE = new Set(['\\', '*', '_', '`', '[', ']']);
/** Zero-width separator between adjacent markers; ignored as text. */
export const MARK_SEPARATOR = '\u2060';
const MAX_DEPTH = 4;

/** Backslash-escape every inline marker so text renders literally in v2. */
export function escapeInline(text: string): string {
  let out = '';
  for (const ch of text) out += ESCAPABLE.has(ch) ? `\\${ch}` : ch;
  return out;
}

function pushText(out: InlineNode[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

/** Index of the next unescaped `marker` at or after `from`, or -1. */
function findClose(src: string, marker: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src.startsWith(marker, i)) return i;
  }
  return -1;
}

function findLinkLabelEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') { i++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

/** Closing `)` of a link target, allowing balanced parentheses inside it. */
function findHrefEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) return i;
      depth--;
    } else if (ch === ' ' || ch === '\n') return -1;
  }
  return -1;
}

function parse(src: string, depth: number): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === MARK_SEPARATOR) {
      i++;
      continue;
    }
    if (ch === '\\' && i + 1 < src.length && ESCAPABLE.has(src[i + 1]!)) {
      pushText(out, src[i + 1]!);
      i += 2;
      continue;
    }
    if (ch === '`') {
      const close = src.indexOf('`', i + 1);
      if (close > i + 1) {
        out.push({ type: 'code', text: src.slice(i + 1, close).replace(/\u2060/g, '') });
        i = close + 1;
        continue;
      }
    }
    if (depth < MAX_DEPTH && ch === '*' && src[i + 1] === '*') {
      let close = findClose(src, '**', i + 2);
      // In a closing run like `***`, the last two stars close the bold.
      while (close !== -1 && src[close + 2] === '*') close++;
      if (close > i + 2 && !/\s/.test(src[i + 2]!) && !/\s/.test(src[close - 1]!)) {
        out.push({ type: 'bold', children: parse(src.slice(i + 2, close), depth + 1) });
        i = close + 2;
        continue;
      }
    }
    if (depth < MAX_DEPTH && (ch === '*' || ch === '_') && src[i + 1] !== ch) {
      // Intraword underscores (snake_case) stay literal.
      const intraword = ch === '_' && i > 0 && /[\p{L}\p{N}]/u.test(src[i - 1]!);
      const next = src[i + 1];
      if (!intraword && next && !/\s/.test(next)) {
        let close = findClose(src, ch, i + 1);
        while (close !== -1 && src[close + 1] === ch && ch === '*') close = findClose(src, ch, close + 2);
        const after = close === -1 ? undefined : src[close + 1];
        const okAfter = ch !== '_' || !after || !/[\p{L}\p{N}]/u.test(after);
        if (close > i + 1 && !/\s/.test(src[close - 1]!) && okAfter) {
          out.push({ type: 'italic', children: parse(src.slice(i + 1, close), depth + 1) });
          i = close + 1;
          continue;
        }
      }
    }
    if (depth < MAX_DEPTH && ch === '[') {
      const end = findLinkLabelEnd(src, i + 1);
      if (end > i + 1 && src[end + 1] === '(') {
        const close = findHrefEnd(src, end + 2);
        if (close !== -1) {
          const rawHref = src.slice(end + 2, close).trim();
          const label = parse(src.slice(i + 1, end), depth + 1);
          const href = rawHref && !/\s/.test(rawHref) ? sanitizeHref(rawHref) : null;
          if (href) out.push({ type: 'link', href, children: label });
          else for (const n of label) out.push(n); // unsafe href: keep the label as text
          i = close + 1;
          continue;
        }
      }
    }
    pushText(out, ch);
    i++;
  }
  return out;
}

/** Parse v2 block content into inline nodes. Unsafe link targets become plain text. */
export function parseInline(content: string | undefined | null): InlineNode[] {
  return parse((content ?? '').replace(/\u200B/g, ''), 0);
}

export function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === 'text' || n.type === 'code' ? n.text : inlineNodesToText(n.children))).join('');
}

/** v2 content without markers (for search, previews, and accessibility labels). */
export function inlineToPlainText(content: string | undefined | null): string {
  return inlineNodesToText(parseInline(content));
}

export const LINK_REL = 'noopener noreferrer nofollow';

export function inlineNodesToHtml(nodes: InlineNode[]): string {
  return nodes.map((n) => {
    switch (n.type) {
      case 'text': return escapeHtml(n.text).replace(/\n/g, '<br />');
      case 'code': return `<code>${escapeHtml(n.text)}</code>`;
      case 'bold': return `<strong>${inlineNodesToHtml(n.children)}</strong>`;
      case 'italic': return `<em>${inlineNodesToHtml(n.children)}</em>`;
      case 'link': {
        const external = /^(https?:|mailto:|tel:)/i.test(n.href);
        const attrs = external ? ` target="_blank" rel="${LINK_REL}"` : '';
        return `<a href="${escapeHtml(n.href)}"${attrs}>${inlineNodesToHtml(n.children)}</a>`;
      }
    }
  }).join('');
}

/** Sanitized HTML for v2 block content. Never passes raw HTML through. */
export function renderInlineHtml(content: string | undefined | null): string {
  return inlineNodesToHtml(parseInline(content));
}

const MARKERS: Record<Exclude<InlineMark, 'link'>, string> = { bold: '**', italic: '*', code: '`' };

/**
 * Wrap (or unwrap) `content[start:end]` in a mark's markers. Returns the new
 * content and the selection range of the original text. For `link`, pass
 * `href`; an empty selection inserts `[href](href)`.
 */
export function toggleInlineMark(
  content: string,
  start: number,
  end: number,
  mark: InlineMark,
  href?: string,
): { content: string; start: number; end: number } {
  const a = Math.max(0, Math.min(start, end, content.length));
  const b = Math.min(content.length, Math.max(start, end));
  const sel = content.slice(a, b);
  if (mark === 'link') {
    const target = (href ?? '').trim();
    if (!target) return { content, start: a, end: b };
    const label = sel || target;
    const next = `${content.slice(0, a)}[${label}](${target})${content.slice(b)}`;
    return { content: next, start: a + 1, end: a + 1 + label.length };
  }
  const m = MARKERS[mark];
  const before = content.slice(Math.max(0, a - m.length), a);
  const after = content.slice(b, b + m.length);
  if (before === m && after === m && !(mark === 'italic' && content.slice(a - 2, a) === '**' && content.slice(b, b + 2) === '**')) {
    const next = content.slice(0, a - m.length) + sel + content.slice(b + m.length);
    return { content: next, start: a - m.length, end: b - m.length };
  }
  if (sel.length > m.length * 2 && sel.startsWith(m) && sel.endsWith(m)) {
    const inner = sel.slice(m.length, sel.length - m.length);
    return { content: content.slice(0, a) + inner + content.slice(b), start: a, end: a + inner.length };
  }
  const next = `${content.slice(0, a)}${m}${sel}${m}${content.slice(b)}`;
  return { content: next, start: a + m.length, end: b + m.length };
}
