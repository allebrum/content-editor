import { parseDocument } from './schema';
import type { Block, EditorDocument } from './types';
export { renderDocumentHtml, renderBlockHtml } from './render-html';
export { escapeHtml } from './sanitize';
export { sanitizeHref, isSafeHref } from './sanitize';

function textOf(block: Block): string {
  return block.content ?? '';
}

/** React renderer — children are text nodes, never raw HTML. */
export function BlockRenderer({ value }: { value: EditorDocument | unknown }) {
  const doc = parseDocument(value);
  return (
    <div className="pe-render">
      {doc.blocks.map((block) => (
        <RenderedBlock key={block.id} block={block} />
      ))}
    </div>
  );
}

function RenderedBlock({ block }: { block: Block }) {
  const text = textOf(block);
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
