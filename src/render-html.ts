import { escapeHtml } from './sanitize';
import { parseDocument } from './schema';
import type { Block } from './types';

function textOf(block: Block): string {
  return block.content ?? '';
}

export function renderDocumentHtml(value: unknown): string {
  const doc = parseDocument(value);
  return doc.blocks.map(renderBlockHtml).join('\n');
}

export function renderBlockHtml(block: Block): string {
  const text = escapeHtml(textOf(block));
  switch (block.type) {
    case 'h1': return `<h1>${text}</h1>`;
    case 'h2': return `<h2>${text}</h2>`;
    case 'h3': return `<h3>${text}</h3>`;
    case 'bullet': return `<li>${text}</li>`;
    case 'numbered': return `<li>${text}</li>`;
    case 'checkbox':
      return `<li><input type="checkbox" disabled${block.checked ? ' checked' : ''} /> ${text}</li>`;
    case 'quote': return `<blockquote>${text.replace(/\n/g, '<br />')}</blockquote>`;
    case 'callout': return `<aside class="pe-callout">${text.replace(/\n/g, '<br />')}</aside>`;
    case 'divider': return '<hr />';
    default: return `<p>${text}</p>`;
  }
}
