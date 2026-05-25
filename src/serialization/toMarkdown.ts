import type { EditorJsonDocument } from '../schema/types';
import type { Block, TextNode } from '../schema/types';

function blockToMarkdown(block: Block): string {
  const b = block as {
    type: string;
    text?: string;
    marks?: { type: string; attrs?: Record<string, unknown> }[];
    content?: Block[];
    attrs?: Record<string, unknown>;
  };

  if (b.type === 'text') {
    let text = (b as TextNode).text ?? '';
    for (const mark of b.marks ?? []) {
      switch (mark.type) {
        case 'bold': text = `**${text}**`; break;
        case 'italic': text = `*${text}*`; break;
        case 'code': text = `\`${text}\``; break;
        case 'strike': text = `~~${text}~~`; break;
        case 'link': text = `[${text}](${mark.attrs?.href ?? '#'})`; break;
      }
    }
    return text;
  }

  if (b.type === 'hardBreak') return '  \n';
  if (b.type === 'horizontalRule') return '\n---\n\n';

  const inner = () => (b.content ?? []).map(blockToMarkdown).join('');

  switch (b.type) {
    case 'heading': {
      const level = (b.attrs?.level ?? 2) as number;
      return '#'.repeat(level) + ' ' + inner() + '\n\n';
    }
    case 'paragraph':
      return inner() + '\n\n';
    case 'blockquote':
      return inner().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
    case 'bulletList':
      return (b.content ?? []).map(blockToMarkdown).join('') + '\n';
    case 'orderedList': {
      const start = (b.attrs?.start ?? 1) as number;
      return (b.content ?? []).map((item, i) => `${start + i}. ${blockToMarkdown(item).replace(/^[•\d.]+\s*/, '')}`).join('') + '\n';
    }
    case 'listItem':
      return '- ' + inner().replace(/\n\n$/, '') + '\n';
    case 'taskItem': {
      const checked = b.attrs?.checked ? '[x]' : '[ ]';
      return `- ${checked} ${inner().replace(/\n\n$/, '')}\n`;
    }
    case 'codeBlock': {
      const lang = b.attrs?.language ? String(b.attrs.language) : '';
      return `\`\`\`${lang}\n${inner()}\n\`\`\`\n\n`;
    }
    case 'image':
    case 'imageBlock': {
      const { src, alt, caption } = b.attrs ?? {};
      const md = `![${alt ?? ''}](${src ?? ''})`;
      return caption ? `${md}\n*${caption}*\n\n` : md + '\n\n';
    }
    case 'button': {
      const { label, href } = b.attrs ?? {};
      return `[${label ?? 'Button'}](${href ?? '#'})\n\n`;
    }
    default:
      return inner() + '\n';
  }
}

export function toMarkdown(doc: EditorJsonDocument): string {
  return (doc.content ?? [])
    .map(blockToMarkdown)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
