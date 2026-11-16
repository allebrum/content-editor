import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../components/BlockEditor';
import { getOffsets, setCaret, setSelectionRange } from '../dom';
import { canonicalContent } from '../rich';
import { readRichContent } from '../rich-dom';
import type { AnyEditorDocument, EditorDocumentV2 } from '../types';

type Doc = EditorDocumentV2;
const doc = (...contents: string[]): Doc => ({
  version: 2,
  blocks: contents.map((content, i) => ({ id: String.fromCharCode(97 + i), type: 'text' as const, content })),
});
const lastDoc = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as AnyEditorDocument;
const contentOf = (fn: ReturnType<typeof vi.fn>, i = 0) => (lastDoc(fn).blocks[i] as { content?: string }).content;

function setup(value: Doc, props: Partial<Parameters<typeof BlockEditor<Doc>>[0]> = {}) {
  const onChange = vi.fn();
  render(<BlockEditor<Doc> value={value} onChange={onChange} {...props} />);
  return { onChange, box: (id = 'a') => screen.getByTestId(`block-${id}`) };
}

function select(el: HTMLElement, start: number, end = start) {
  el.focus();
  setSelectionRange(el, start, end);
}

/** Type like a browser: beforeinput (cancelable), then edit the text node at the caret, then input. */
function type(el: HTMLElement, text: string) {
  for (const ch of text) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: ch, bubbles: true, cancelable: true });
    act(() => { el.dispatchEvent(before); });
    if (before.defaultPrevented) continue;
    const sel = window.getSelection()!;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    let node = r.startContainer;
    let offset = r.startOffset;
    if (node.nodeType !== 3) {
      const t = document.createTextNode('');
      const ref = node.childNodes[offset] ?? null;
      node.insertBefore(t, ref);
      node = t;
      offset = 0;
    }
    const t = node as Text;
    t.insertData(offset, ch);
    const after = document.createRange();
    after.setStart(t, offset + 1);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    fireEvent.input(el, { inputType: 'insertText', data: ch });
  }
}

const key = (el: HTMLElement, k: string, opts: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(el, { key: k, ...opts });

describe('WYSIWYG inline marks (v2)', () => {
  it('renders stored marks as formatted elements with no visible markers', () => {
    const { box } = setup(doc('say **hi**, *you* `npm i` [docs](https://d.example/)'));
    const el = box();
    expect(el.textContent).toBe('say hi, you npm i docs');
    expect(el.querySelector('strong')!.textContent).toBe('hi');
    expect(el.querySelector('em')!.textContent).toBe('you');
    expect(el.querySelector('code')!.textContent).toBe('npm i');
    const a = el.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://d.example/');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('round-trips complex content through the DOM unchanged', () => {
    const content = 'a ***b*** c *d **e*** [f **g**](https://x.example/a_(b)) \\* `h`\nnext';
    const { box } = setup(doc(content));
    expect(readRichContent(box())).toBe(canonicalContent(content));
    expect(canonicalContent(readRichContent(box()))).toBe(readRichContent(box()));
  });

  it('typing inside bold stays bold, and the caret stays where it was', () => {
    const { box, onChange } = setup(doc('say **hi** now'));
    const el = box();
    select(el, 6);
    type(el, 'gh');
    expect(contentOf(onChange)).toBe('say **high** now');
    expect(getOffsets(el)).toEqual({ start: 8, end: 8 });
    expect(el.querySelector('strong')!.textContent).toBe('high');
  });

  it('Ctrl/⌘+B toggles bold on the selection and keeps the selection', () => {
    const { box, onChange } = setup(doc('hello world'));
    const el = box();
    select(el, 6, 11);
    key(el, 'b', { ctrlKey: true });
    expect(contentOf(onChange)).toBe('hello **world**');
    expect(el.querySelector('strong')!.textContent).toBe('world');
    expect(getOffsets(el)).toEqual({ start: 6, end: 11 });
    key(el, 'b', { metaKey: true });
    expect(contentOf(onChange)).toBe('hello world');
    expect(el.querySelector('strong')).toBeNull();
    expect(getOffsets(el)).toEqual({ start: 6, end: 11 });
  });

  it('Ctrl/⌘+I and E add italic and code; marks nest', () => {
    const { box, onChange } = setup(doc('**hello**'));
    const el = box();
    select(el, 1, 4);
    key(el, 'i', { ctrlKey: true });
    expect(contentOf(onChange)).toBe('**h*ell*o**');
    select(el, 0, 5);
    key(el, 'e', { ctrlKey: true });
    expect(el.querySelectorAll('code').length).toBeGreaterThan(0);
    expect(el.textContent).toBe('hello');
  });

  it('format bar buttons apply marks and show the active state', () => {
    const { box, onChange } = setup(doc('hello world'));
    const el = box();
    select(el, 0, 5);
    const bold = screen.getByRole('button', { name: 'Bold' });
    fireEvent.mouseDown(bold);
    fireEvent.click(bold);
    expect(contentOf(onChange)).toBe('**hello** world');
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    expect(bold).toHaveAttribute('aria-pressed', 'true');
    select(el, 7);
    act(() => { document.dispatchEvent(new Event('selectionchange')); });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
  });

  it('with nothing selected, Ctrl+B toggles bold for the next typed text', () => {
    const { box, onChange } = setup(doc('ab'));
    const el = box();
    select(el, 2);
    key(el, 'b', { ctrlKey: true });
    type(el, 'cd');
    expect(contentOf(onChange)).toBe('ab**cd**');
    key(el, 'b', { ctrlKey: true });
    type(el, 'e');
    expect(contentOf(onChange)).toBe('ab**cd**e');
    expect(el.textContent).toBe('abcde');
  });

  it('auto-converts **text** while typing; the markers disappear and typing continues plain', () => {
    const { box, onChange } = setup(doc(''));
    const el = box();
    select(el, 0);
    type(el, 'say **hi**');
    expect(el.textContent).toBe('say hi');
    expect(contentOf(onChange)).toBe('say **hi**');
    expect(getOffsets(el)).toEqual({ start: 6, end: 6 });
    type(el, ' there');
    expect(contentOf(onChange)).toBe('say **hi** there');
  });

  it('auto-converts *italic*, `code` and [links](url), but not snake_case', () => {
    const { box, onChange } = setup(doc(''));
    const el = box();
    select(el, 0);
    type(el, 'a *b* `c` [d](https://d.example/) snake_case_x');
    expect(el.textContent).toBe('a b c d snake_case_x');
    expect(contentOf(onChange)).toBe('a *b* `c` [d](https://d.example/) snake\\_case\\_x');
  });

  it('Undo first restores the typed markers, then the text; Redo reapplies', () => {
    const { box, onChange } = setup(doc(''));
    const el = box();
    select(el, 0);
    type(el, '**hi**');
    expect(contentOf(onChange)).toBe('**hi**');
    key(el, 'z', { ctrlKey: true });
    expect(contentOf(onChange)).toBe('\\*\\*hi\\*\\*');
    expect(el.textContent).toBe('**hi**');
    key(el, 'z', { ctrlKey: true });
    expect(el.textContent).toBe('');
    key(el, 'z', { ctrlKey: true, shiftKey: true });
    expect(el.textContent).toBe('**hi**');
    key(el, 'y', { ctrlKey: true });
    expect(contentOf(onChange)).toBe('**hi**');
  });

  it('Undo reverts a mark toggle, including the browser Undo command', () => {
    const { box, onChange } = setup(doc('hello world'));
    const el = box();
    select(el, 0, 5);
    key(el, 'b', { ctrlKey: true });
    expect(contentOf(onChange)).toBe('**hello** world');
    const ev = new InputEvent('beforeinput', { inputType: 'historyUndo', bubbles: true, cancelable: true });
    act(() => { el.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(contentOf(onChange)).toBe('hello world');
    expect(getOffsets(el)).toEqual({ start: 0, end: 5 });
  });

  it('Ctrl/⌘+K links the selection with a safe URL and unlinks inside a link', async () => {
    const requestLink = vi.fn().mockResolvedValueOnce('https://docs.example/').mockResolvedValueOnce('javascript:alert(1)');
    const { box, onChange } = setup(doc('see docs and more'), { requestLink });
    const el = box();
    select(el, 4, 8);
    key(el, 'k', { ctrlKey: true });
    await vi.waitFor(() => expect(contentOf(onChange)).toBe('see [docs](https://docs.example/) and more'));
    expect(requestLink).toHaveBeenCalledWith('docs');
    select(el, 6);
    key(el, 'k', { ctrlKey: true });
    await vi.waitFor(() => expect(contentOf(onChange)).toBe('see docs and more'));
    expect(requestLink).toHaveBeenCalledTimes(1);
    select(el, 9, 12);
    key(el, 'k', { ctrlKey: true });
    await vi.waitFor(() => expect(screen.getByText('That link is not allowed')).toBeInTheDocument());
    expect(contentOf(onChange)).toBe('see docs and more');
  });

  it('sanitizes pasted HTML: keeps bold, italic, code and safe links only', () => {
    const { box, onChange } = setup(doc('x'));
    const el = box();
    select(el, 1);
    fireEvent.paste(el, {
      clipboardData: {
        files: [],
        getData: (t: string) => (t === 'text/html'
          ? '<meta charset="utf-8"><b style="font-weight:normal" id="docs-internal-guid-1"><span>Hi </span><span style="font-weight:700">there</span> <i>you</i> <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://ok.example/" onclick="x()">ok</a><img src=x onerror="alert(1)"><code>c</code></b>'
          : 'Hi there you bad ok c'),
      },
    });
    expect(contentOf(onChange)).toBe('xHi **there** *you* bad [ok](https://ok.example/)`c`');
    expect(el.querySelector('script, img, [onclick]')).toBeNull();
  });

  it('pastes formatted multi-line HTML as blocks', () => {
    const { box, onChange } = setup(doc(''));
    const el = box();
    select(el, 0);
    fireEvent.paste(el, {
      clipboardData: { files: [], getData: (t: string) => (t === 'text/html' ? '<p>One <strong>two</strong></p><p><em>three</em></p>' : 'One two\nthree') },
    });
    const blocks = lastDoc(onChange).blocks as { content?: string }[];
    expect(blocks.map((b) => b.content)).toEqual(['One **two**', '*three*']);
  });

  it('pastes plain text literally (markers are escaped, not formatted)', () => {
    const { box, onChange } = setup(doc(''));
    const el = box();
    select(el, 0);
    fireEvent.paste(el, { clipboardData: { files: [], getData: (t: string) => (t === 'text/plain' ? '2 * 3 = **6**' : '') } });
    expect(contentOf(onChange)).toBe('2 \\* 3 = \\*\\*6\\*\\*');
    expect(el.textContent).toBe('2 * 3 = **6**');
  });

  it('normalizes markup a browser inserts (spans, fonts) into canonical formatting', () => {
    const { box, onChange } = setup(doc('a'));
    const el = box();
    el.innerHTML = 'a<span style="font-weight: 700">b</span><font color="red">c</font><b><i>d</i></b><div>e</div>';
    setCaret(el, 4);
    fireEvent.input(el);
    expect(contentOf(onChange)).toBe('a**b**c***d***\ne'.replace('***d***', canonicalContent('***d***')));
    expect(el.querySelector('span, font, div, b, i')).toBeNull();
    expect(el.textContent).toBe('abcd\ne');
  });

  it('does not format or rewrite the DOM during IME composition', () => {
    const { box, onChange } = setup(doc('**ab**'));
    const el = box();
    select(el, 2);
    const calls = onChange.mock.calls.length;
    fireEvent.compositionStart(el);
    const strong = el.querySelector('strong')!;
    (strong.firstChild as Text).appendData('にほ');
    fireEvent.input(el, { inputType: 'insertCompositionText', data: 'にほ', isComposing: true });
    expect(onChange.mock.calls.length).toBe(calls);
    expect(el.querySelector('strong')).toBe(strong);
    fireEvent.compositionEnd(el, { data: 'にほ' });
    expect(contentOf(onChange)).toBe('**abにほ**');
  });

  it('applies toggled marks to text composed with an IME', () => {
    const { box, onChange } = setup(doc('ab'));
    const el = box();
    select(el, 2);
    key(el, 'i', { ctrlKey: true });
    fireEvent.compositionStart(el);
    (el.firstChild as Text).appendData('日本');
    setCaret(el, 4);
    fireEvent.compositionEnd(el, { data: '日本' });
    expect(contentOf(onChange)).toBe('ab*日本*');
  });

  it('Enter splits formatted text, keeping marks on both sides', () => {
    const { box, onChange } = setup(doc('**hello** world'));
    const el = box();
    select(el, 2);
    key(el, 'Enter');
    const blocks = lastDoc(onChange).blocks as { content?: string }[];
    expect(blocks.map((b) => b.content)).toEqual(['**he**', '**llo** world']);
  });

  it('Backspace at the start merges blocks without markers bleeding together', () => {
    const { box, onChange } = setup(doc('*a*', '*b*'));
    const el = box('b');
    select(el, 0);
    key(el, 'Backspace');
    const blocks = lastDoc(onChange).blocks as { content?: string }[];
    expect(blocks.map((b) => b.content)).toEqual(['*ab*']);
  });

  it('markdown block shortcuts keep the inline marks of the rest', () => {
    const { box, onChange } = setup(doc('**x**'));
    const el = box();
    select(el, 0);
    type(el, '# ');
    const b = lastDoc(onChange).blocks[0] as { type: string; content?: string };
    expect(b).toMatchObject({ type: 'h1', content: '**x**' });
  });

  it('read-only v2 shows formatted text and no format bar', () => {
    setup(doc('**x**'), { readOnly: true });
    expect(screen.getByTestId('block-a').querySelector('strong')).not.toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Text formatting' })).toBeNull();
  });

  it('v1 documents are untouched: markers stay literal text', () => {
    const onChange = vi.fn();
    render(<BlockEditor value={{ version: 1, blocks: [{ id: 'a', type: 'text', content: 'say **hi**' }] }} onChange={onChange} />);
    const el = screen.getByTestId('block-a');
    expect(el.textContent).toBe('say **hi**');
    expect(el.querySelector('strong')).toBeNull();
    expect(el.dataset.rich).toBeUndefined();
  });
});
