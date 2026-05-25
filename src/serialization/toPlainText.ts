import type { EditorJsonDocument, Block, TextNode } from '../schema/types';

function blockToText(block: Block): string {
  const b = block as {
    type: string;
    text?: string;
    content?: Block[];
    attrs?: Record<string, unknown>;
  };

  if (b.type === 'text') {
    return (b as TextNode).text ?? '';
  }

  if (b.type === 'hardBreak') return '\n';
  if (b.type === 'horizontalRule') return '\n---\n';
  if (b.type === 'spacer') return '\n';

  if (b.type === 'button') {
    const attrs = b.attrs ?? {};
    return `[${attrs.label ?? 'Button'}](${attrs.href ?? '#'})\n`;
  }

  if (!b.content) return '';

  const childText = b.content.map(blockToText).join('');

  switch (b.type) {
    case 'heading': {
      const level = (b.attrs?.level ?? 2) as number;
      const prefix = '#'.repeat(level) + ' ';
      return prefix + childText + '\n\n';
    }
    case 'paragraph':
      return childText + '\n\n';
    case 'blockquote':
      return childText
        .split('\n')
        .map((l) => '> ' + l)
        .join('\n') + '\n\n';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return childText;
    case 'listItem':
    case 'taskItem':
      return '• ' + childText.trim() + '\n';
    case 'codeBlock':
      return '```\n' + childText + '\n```\n\n';
    default:
      return childText + (childText.endsWith('\n') ? '' : '\n');
  }
}

export function toPlainText(doc: EditorJsonDocument): string {
  return (doc.content ?? [])
    .map(blockToText)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
