/**
 * DOM side of WYSIWYG inline marks: render v2 content as formatted spans in
 * a contentEditable, read it back, and sanitize pasted HTML.
 *
 * Invariant (like `dom.ts` for plain text): an editable block holds only text
 * nodes, each wrapped in at most `<a> <strong> <em> <code>` (in that order),
 * plus a trailing ZWSP sentinel after a final newline. Anything else a
 * browser inserts is normalized away on the next input.
 */
import { ZWSP } from './dom';
import { cleanMarks, richFromContent, richSegments, serializeRich, type Marks, type RichChar } from './rich';
import { sanitizeHref } from './sanitize';

const BLOCK_TAGS = new Set([
  'DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'TR', 'TABLE', 'SECTION', 'ARTICLE',
]);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TITLE', 'META', 'LINK', 'BUTTON', 'SELECT', 'TEXTAREA', 'INPUT', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS']);

/** Marks an element adds (tags, plus inline styles from Google Docs / Word). */
function elementMarks(el: Element, m: Marks): Marks {
  const tag = el.tagName.toUpperCase();
  const next: Marks = { ...m };
  const style = (el as HTMLElement).style;
  const weight = style?.fontWeight ?? '';
  const normalWeight = weight === 'normal' || weight === 'lighter' || (/^\d+$/.test(weight) && Number(weight) < 600);
  if ((tag === 'STRONG' || tag === 'B') && !normalWeight) next.bold = true;
  if (weight === 'bold' || weight === 'bolder' || (/^\d+$/.test(weight) && Number(weight) >= 600)) next.bold = true;
  if (normalWeight && tag !== 'STRONG' && tag !== 'B') next.bold = false;
  const fontStyle = style?.fontStyle ?? '';
  if ((tag === 'EM' || tag === 'I') && fontStyle !== 'normal') next.italic = true;
  if (fontStyle === 'italic' || fontStyle === 'oblique') next.italic = true;
  if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') next.code = true;
  if (tag === 'A') {
    const href = sanitizeHref(el.getAttribute('href'));
    if (href) next.href = href;
  }
  return cleanMarks(next);
}

/**
 * Read an editable block: the same text `readText()` returns (so offsets
 * agree), with the marks of the formatting elements around each character.
 */
export function readRich(root: Node, opts: { ignoreTrailingBr?: boolean } = {}): RichChar[] {
  const ignoreTrailingBr = opts.ignoreTrailingBr ?? true;
  const out: RichChar[] = [];
  const endsWithNewline = () => out.length > 0 && out[out.length - 1]!.ch === '\n';
  const walk = (n: Node, isRoot: boolean, m: Marks) => {
    if (n.nodeType === 3) {
      const v = n.nodeValue ?? '';
      for (let i = 0; i < v.length; i++) {
        const ch = v[i]!;
        if (ch === ZWSP) continue;
        out.push({ ch: ch === '\u00A0' ? ' ' : ch, m });
      }
      return;
    }
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    const name = n.nodeName;
    if (name === 'SCRIPT' || name === 'STYLE' || name === 'TEMPLATE') return;
    if (name === 'BR') {
      if (ignoreTrailingBr && n.parentNode && n.parentNode.lastChild === n) return;
      out.push({ ch: '\n', m: cleanMarks({ ...m, code: false, href: undefined }) });
      return;
    }
    const isBlock = !isRoot && n.nodeType === 1 && BLOCK_TAGS.has(name);
    if (isBlock && out.length > 0 && !endsWithNewline()) out.push({ ch: '\n', m: {} });
    const inner = n.nodeType === 1 && !isRoot ? elementMarks(n as Element, m) : m;
    n.childNodes.forEach((c) => walk(c, false, inner));
  };
  walk(root, true, {});
  return out;
}

/** Serialized v2 content of an editable block. */
export function readRichContent(el: Node): string {
  return serializeRich(readRich(el, { ignoreTrailingBr: true }));
}

function buildNodes(doc: Document, content: string): Node[] {
  const nodes: Node[] = [];
  const segs = richSegments(richFromContent(content));
  for (const s of segs) {
    let node: Node = doc.createTextNode(s.text);
    if (s.code) { const e = doc.createElement('code'); e.appendChild(node); node = e; }
    if (s.italic) { const e = doc.createElement('em'); e.appendChild(node); node = e; }
    if (s.bold) { const e = doc.createElement('strong'); e.appendChild(node); node = e; }
    if (s.href) {
      const e = doc.createElement('a');
      e.setAttribute('href', s.href);
      e.setAttribute('rel', 'noopener noreferrer nofollow');
      e.appendChild(node);
      node = e;
    }
    nodes.push(node);
  }
  const last = segs[segs.length - 1];
  if (last && last.text.endsWith('\n')) nodes.push(doc.createTextNode(ZWSP));
  return nodes;
}

/** Replace the element's contents with the formatted rendering of v2 `content`. */
export function writeRich(el: HTMLElement, content: string): void {
  el.replaceChildren(...buildNodes(el.ownerDocument, content));
}

/** True when the DOM differs from the canonical rendering of `content`. */
export function needsRichNormalize(el: HTMLElement, content: string): boolean {
  const probe = el.ownerDocument.createElement('div');
  probe.replaceChildren(...buildNodes(el.ownerDocument, content));
  return probe.innerHTML !== el.innerHTML;
}

/** Marks of the formatting elements around a DOM point inside `root`. */
export function marksAtNode(root: HTMLElement, node: Node | null): Marks {
  const chain: Element[] = [];
  let n: Node | null = node && node.nodeType === 1 ? node : node?.parentNode ?? null;
  while (n && n !== root) {
    if (n.nodeType === 1) chain.unshift(n as Element);
    n = n.parentNode;
  }
  return chain.reduce<Marks>((m, el) => elementMarks(el, m), {});
}

function collapse(chars: RichChar[]): RichChar[] {
  const out: RichChar[] = [];
  for (const c of chars) {
    const ch = c.ch === '\t' || c.ch === '\r' ? ' ' : c.ch;
    if (ch === ' ' && (out.length === 0 || out[out.length - 1]!.ch === ' ' || out[out.length - 1]!.ch === '\n')) continue;
    if (ch === '\n' && out.length && out[out.length - 1]!.ch === ' ') out.pop();
    out.push({ ch, m: c.m });
  }
  return out;
}

/**
 * Sanitize pasted HTML into v2 content lines. Only bold, italic, code and
 * safe links survive; everything else becomes plain text. The HTML is parsed
 * in an inert document (no scripts run, nothing loads) and never inserted.
 */
export function htmlToContentLines(html: string): string[] {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const chars: RichChar[] = [];
  const walk = (n: Node, m: Marks, pre: boolean) => {
    if (n.nodeType === 3) {
      const v = (n.nodeValue ?? '').replace(/\u200B/g, '').replace(/\u00A0/g, ' ');
      for (const ch of pre ? v : v.replace(/[\r\n\t]+/g, ' ')) chars.push({ ch, m });
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    const tag = el.tagName.toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    if (tag === 'BR') { chars.push({ ch: '\n', m: {} }); return; }
    const block = BLOCK_TAGS.has(tag);
    if (block && chars.length && chars[chars.length - 1]!.ch !== '\n') chars.push({ ch: '\n', m: {} });
    const inner = elementMarks(el, m);
    el.childNodes.forEach((c) => walk(c, inner, pre || tag === 'PRE'));
    if (block && chars.length && chars[chars.length - 1]!.ch !== '\n') chars.push({ ch: '\n', m: {} });
  };
  walk(doc.body, {}, false);
  const flat = collapse(chars);
  const lines: RichChar[][] = [[]];
  for (const c of flat) {
    if (c.ch === '\n') lines.push([]);
    else lines[lines.length - 1]!.push(c);
  }
  const trimmed = lines.map((l) => {
    let a = 0;
    let b = l.length;
    while (a < b && l[a]!.ch === ' ') a++;
    while (b > a && l[b - 1]!.ch === ' ') b--;
    return l.slice(a, b);
  });
  while (trimmed.length && trimmed[0]!.length === 0) trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1]!.length === 0) trimmed.pop();
  return trimmed.map((l) => serializeRich(l));
}
