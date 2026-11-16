import { escapeHtml } from './sanitize';
import { parseAnyDocument } from './schema';
import { renderInlineHtml } from './inline';
import { VIDEO_IFRAME_ATTRS, providerLabel, sanitizeImageSrc, videoEmbedUrl } from './media';
import type { AnyBlock, Block, ImageBlock, VideoBlock } from './types';

export type RenderHtmlOptions = {
  /**
   * Rewrite an image URL before output (e.g. to an image CDN). The result is
   * re-validated; an unsafe return value drops the image.
   */
  imageSrc?: (block: ImageBlock) => string;
  /** Extra `srcset` for an image; same validation as `imageSrc`. */
  imageSrcSet?: (block: ImageBlock) => string | null | undefined;
};

function textOf(block: Pick<AnyBlock, 'content'>): string {
  return block.content ?? '';
}

/**
 * Render a v1 or v2 document to sanitized HTML. v1 output is unchanged from
 * 1.0.0. v2 adds inline marks, images, and video iframes.
 */
export function renderDocumentHtml(value: unknown, options: RenderHtmlOptions = {}): string {
  const doc = parseAnyDocument(value);
  const v2 = doc.version === 2;
  return doc.blocks.map((b) => renderAnyBlockHtml(b as AnyBlock, { ...options, inlineMarks: v2 })).join('\n');
}

/** Render one v1 block. Text is escaped literally (no inline marks). */
export function renderBlockHtml(block: Block): string {
  return renderAnyBlockHtml(block, { inlineMarks: false });
}

function renderImageHtml(block: ImageBlock, options: RenderHtmlOptions): string {
  const src = sanitizeImageSrc(options.imageSrc ? options.imageSrc(block) : block.src);
  if (!src) return '';
  const rawSet = options.imageSrcSet?.(block);
  const srcset = rawSet
    ? rawSet.split(',').map((part) => {
      const [u, d] = part.trim().split(/\s+/, 2);
      const safe = sanitizeImageSrc(u);
      return safe && (!d || /^\d+(\.\d+)?[wx]$/.test(d)) ? `${safe}${d ? ` ${d}` : ''}` : null;
    }).filter(Boolean).join(', ')
    : '';
  const width = block.width ? ` style="max-width:${block.width}px"` : '';
  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : '';
  return `<figure class="pe-image"${width}><img src="${escapeHtml(src)}"${srcset ? ` srcset="${escapeHtml(srcset)}"` : ''} alt="${escapeHtml(block.alt ?? '')}" loading="lazy" decoding="async" />${caption}</figure>`;
}

function renderVideoHtml(block: VideoBlock): string {
  const src = videoEmbedUrl(block);
  if (!src) return '';
  const title = escapeHtml(block.title || `${providerLabel(block.provider)} video`);
  const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : '';
  const a = VIDEO_IFRAME_ATTRS;
  return `<figure class="pe-video"><div class="pe-video-frame"><iframe src="${escapeHtml(src)}" title="${title}" allow="${a.allow}" referrerpolicy="${a.referrerPolicy}" sandbox="${a.sandbox}" loading="${a.loading}" allowfullscreen frameborder="0"></iframe></div>${caption}</figure>`;
}

export function renderAnyBlockHtml(
  block: AnyBlock,
  options: RenderHtmlOptions & { inlineMarks?: boolean } = {},
): string {
  if (block.type === 'image') return renderImageHtml(block as ImageBlock, options);
  if (block.type === 'video') return renderVideoHtml(block as VideoBlock);
  const text = options.inlineMarks ? renderInlineHtml(textOf(block)) : escapeHtml(textOf(block));
  const multiline = options.inlineMarks ? text : text.replace(/\n/g, '<br />');
  switch (block.type) {
    case 'h1': return `<h1>${text}</h1>`;
    case 'h2': return `<h2>${text}</h2>`;
    case 'h3': return `<h3>${text}</h3>`;
    case 'bullet': return `<li>${text}</li>`;
    case 'numbered': return `<li>${text}</li>`;
    case 'checkbox':
      return `<li><input type="checkbox" disabled${block.checked ? ' checked' : ''} /> ${text}</li>`;
    case 'quote': return `<blockquote>${multiline}</blockquote>`;
    case 'callout': return `<aside class="pe-callout">${multiline}</aside>`;
    case 'divider': return '<hr />';
    default: return `<p>${text}</p>`;
  }
}
