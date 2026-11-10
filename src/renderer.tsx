import { Fragment, type ReactNode } from 'react';
import { parseAnyDocument } from './schema';
import { parseInline, LINK_REL, type InlineNode } from './inline';
import { VIDEO_IFRAME_ATTRS, providerLabel, sanitizeImageSrc, videoEmbedUrl } from './media';
import type { AnyBlock, AnyEditorDocument, EditorDocument, ImageBlock, VideoBlock } from './types';
export { renderDocumentHtml, renderBlockHtml, renderAnyBlockHtml } from './render-html';
export type { RenderHtmlOptions } from './render-html';
export { escapeHtml } from './sanitize';
export { sanitizeHref, isSafeHref } from './sanitize';
export { parseInline, renderInlineHtml, inlineToPlainText } from './inline';
export type { InlineNode, InlineMark } from './inline';
export { videoEmbedUrl, videoWatchUrl, sanitizeImageSrc } from './media';

function textOf(block: Pick<AnyBlock, 'content'>): string {
  return block.content ?? '';
}

export type BlockRendererProps = {
  value: EditorDocument | AnyEditorDocument | unknown;
  /** Rewrite image URLs (e.g. to an image CDN). The result is re-validated. */
  imageSrc?: (block: ImageBlock) => string;
};

/** React renderer — children are text nodes and fixed elements, never raw HTML. */
export function BlockRenderer({ value, imageSrc }: BlockRendererProps) {
  const doc = parseAnyDocument(value);
  const marks = doc.version === 2;
  return (
    <div className="pe-render">
      {doc.blocks.map((block) => (
        <RenderedBlock key={block.id} block={block as AnyBlock} marks={marks} imageSrc={imageSrc} />
      ))}
    </div>
  );
}

export function InlineContent({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case 'text': return <Fragment key={i}>{n.text}</Fragment>;
      case 'code': return <code key={i}>{n.text}</code>;
      case 'bold': return <strong key={i}><InlineContent nodes={n.children} /></strong>;
      case 'italic': return <em key={i}><InlineContent nodes={n.children} /></em>;
      case 'link': {
        const external = /^(https?:|mailto:|tel:)/i.test(n.href);
        return (
          <a key={i} href={n.href} {...(external ? { target: '_blank', rel: LINK_REL } : {})}>
            <InlineContent nodes={n.children} />
          </a>
        );
      }
    }
  });
}

function RenderedImage({ block, imageSrc }: { block: ImageBlock; imageSrc?: (b: ImageBlock) => string }) {
  const src = sanitizeImageSrc(imageSrc ? imageSrc(block) : block.src);
  if (!src) return null;
  return (
    <figure className="pe-image" style={block.width ? { maxWidth: block.width } : undefined}>
      <img src={src} alt={block.alt ?? ''} loading="lazy" decoding="async" />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}

export function VideoEmbed({ block }: { block: VideoBlock }) {
  const src = videoEmbedUrl(block);
  if (!src) return null;
  const a = VIDEO_IFRAME_ATTRS;
  return (
    <figure className="pe-video">
      <div className="pe-video-frame">
        <iframe
          src={src}
          title={block.title || `${providerLabel(block.provider)} video`}
          allow={a.allow}
          referrerPolicy={a.referrerPolicy}
          sandbox={a.sandbox}
          loading={a.loading}
          allowFullScreen
          frameBorder={0}
        />
      </div>
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
    </figure>
  );
}

function RenderedBlock({ block, marks, imageSrc }: { block: AnyBlock; marks: boolean; imageSrc?: (b: ImageBlock) => string }) {
  if (block.type === 'image') return <RenderedImage block={block as ImageBlock} imageSrc={imageSrc} />;
  if (block.type === 'video') return <VideoEmbed block={block as VideoBlock} />;
  const text: ReactNode = marks ? <InlineContent nodes={parseInline(textOf(block))} /> : textOf(block);
  switch (block.type) {
    case 'h1': return <h1>{text}</h1>;
    case 'h2': return <h2>{text}</h2>;
    case 'h3': return <h3>{text}</h3>;
    case 'bullet': return <ul><li>{text}</li></ul>;
    case 'numbered': return <ol><li>{text}</li></ol>;
    case 'checkbox':
      return (
        <div className="pe-render-check">
          <input type="checkbox" disabled checked={!!block.checked} readOnly /> {text}
        </div>
      );
    case 'quote': return <blockquote>{text}</blockquote>;
    case 'callout': return <aside className="pe-callout">{text}</aside>;
    case 'divider': return <hr />;
    default: return <p>{text}</p>;
  }
}
