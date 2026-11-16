import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentParseError } from '../errors';
import { renderDocumentHtml } from '../render-html';
import { BlockRenderer } from '../renderer';
import {
  documentFromPlainText, migrateDocument, parseAnyDocument, parseDocument,
} from '../schema';

const v2 = {
  version: 2,
  blocks: [
    { id: 'a', type: 'text', content: 'Hi **there** [docs](https://x.org)' },
    { id: 'b', type: 'image', src: '/img/k1', alt: 'A calm room', width: 480, caption: 'Breathe', assetKey: 'k1' },
    { id: 'c', type: 'video', provider: 'vimeo', videoId: '76979871', hash: 'abcdef', title: 'Breathing exercise' },
  ],
};

describe('document version 2', () => {
  it('parseDocument keeps its v1-only contract', () => {
    const v1 = { version: 1, blocks: [{ id: 'a', type: 'text', content: '2 * 3' }] };
    expect(parseDocument(v1)).toEqual(v1);
    expect(() => parseDocument(v2)).toThrow(/parseAnyDocument/);
    try {
      parseDocument({ version: 1, blocks: [{ id: 'x', type: 'image', src: '/a', alt: '' }] });
    } catch (e) {
      expect((e as DocumentParseError).code).toBe('unsupported_block_type');
    }
  });

  it('parseAnyDocument reads v1 unchanged and validates v2 media', () => {
    const v1 = { version: 1, blocks: [{ id: 'a', type: 'text', content: 'x' }] };
    expect(parseAnyDocument(v1)).toEqual(v1);
    expect(parseAnyDocument(v2)).toEqual(v2);
    const bad = (block: object) => () => parseAnyDocument({ version: 2, blocks: [{ id: 'z', ...block }] });
    expect(bad({ type: 'image', src: 'javascript:alert(1)', alt: '' })).toThrow(DocumentParseError);
    expect(bad({ type: 'image', src: '/a', alt: '', width: 5 })).toThrow(/width/);
    expect(bad({ type: 'video', provider: 'dailymotion', videoId: '1' })).toThrow(/provider/);
    expect(bad({ type: 'video', provider: 'vimeo', videoId: 'abc' })).toThrow(/invalid vimeo id/);
    expect(bad({ type: 'video', provider: 'youtube', videoId: 'dQw4w9WgXcQ', hash: 'abcdef' })).toThrow(/hash/);
    expect(() => parseAnyDocument({ version: 3, blocks: [] })).toThrow(/versions 1 and 2/);
  });

  it('migrateDocument escapes v1 text so it renders identically', () => {
    const v1 = { version: 1, blocks: [{ id: 'a', type: 'text', content: '**not bold** and [x](y)' }] };
    const up = migrateDocument(v1);
    expect(up.version).toBe(2);
    expect(up.blocks[0]?.id).toBe('a');
    expect(renderDocumentHtml(up)).toBe(renderDocumentHtml(v1));
    expect(migrateDocument(up)).toEqual(up);
  });

  it('documentFromPlainText wraps legacy strings line by line', () => {
    const d = documentFromPlainText('Line *1*\nLine 2\n');
    expect(d.version).toBe(2);
    expect(d.blocks.map((b) => (b as { content?: string }).content)).toEqual(['Line \\*1\\*', 'Line 2']);
    expect(documentFromPlainText('a*b', 1).blocks[0]?.content).toBe('a*b');
  });

  it('v1 HTML output is unchanged by the v2 work', () => {
    const html = renderDocumentHtml({ version: 1, blocks: [{ id: 'a', type: 'text', content: '**x** <b>' }, { id: 'q', type: 'quote', content: 'a\nb' }] });
    expect(html).toBe('<p>**x** &lt;b&gt;</p>\n<blockquote>a<br />b</blockquote>');
  });

  it('renders v2 server HTML with sanitized media and links', () => {
    const html = renderDocumentHtml(v2, { imageSrc: (b) => `/.netlify/images?url=${encodeURIComponent(b.src)}&w=960` });
    expect(html).toContain('<p>Hi <strong>there</strong> <a href="https://x.org/" target="_blank" rel="noopener noreferrer nofollow">docs</a></p>');
    expect(html).toContain('<figure class="pe-image" style="max-width:480px"><img src="/.netlify/images?url=%2Fimg%2Fk1&amp;w=960" alt="A calm room" loading="lazy" decoding="async" /><figcaption>Breathe</figcaption></figure>');
    expect(html).toContain('src="https://player.vimeo.com/video/76979871?dnt=1&amp;h=abcdef"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"');
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(html).toContain('title="Breathing exercise"');
    expect(html).not.toContain('k1"'); // assetKey is never rendered
    const unsafe = renderDocumentHtml(v2, { imageSrc: () => 'javascript:alert(1)' });
    expect(unsafe).not.toContain('<img');
  });

  it('React renderer shows marks, images and video iframes', () => {
    const { container } = render(<BlockRenderer value={v2} />);
    expect(container.querySelector('strong')?.textContent).toBe('there');
    const a = container.querySelector('a')!;
    expect(a.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('A calm room');
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('https://player.vimeo.com/video/76979871?dnt=1&h=abcdef');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
  });

  it('React renderer keeps v1 text literal', () => {
    const { container } = render(<BlockRenderer value={{ version: 1, blocks: [{ id: 'a', type: 'text', content: '**x**' }] }} />);
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toBe('**x**');
  });
});
