import type { BlockDefinition } from './types';

export const BUILT_IN_BLOCK_DEFINITIONS: BlockDefinition[] = [
  { type: 'paragraph', label: 'Paragraph', category: 'text', editableText: true, draggable: true, aiEnabled: true, exportable: true },
  { type: 'heading', label: 'Heading', category: 'text', editableText: true, editableAttrs: ['level', 'textAlign'], draggable: true, aiEnabled: true, exportable: true },
  { type: 'bulletList', label: 'Bulleted list', category: 'text', editableText: true, draggable: true, exportable: true },
  { type: 'orderedList', label: 'Numbered list', category: 'text', editableText: true, draggable: true, exportable: true },
  { type: 'taskList', label: 'Checklist', category: 'text', editableText: true, draggable: true, exportable: true },
  { type: 'blockquote', label: 'Blockquote', category: 'text', editableText: true, draggable: true, aiEnabled: true, exportable: true },
  { type: 'codeBlock', label: 'Code block', category: 'text', editableText: true, editableAttrs: ['language'], draggable: true, exportable: true },
  { type: 'horizontalRule', label: 'Divider', category: 'layout', draggable: true, exportable: true },
  { type: 'image', label: 'Image', category: 'media', editableAttrs: ['src', 'alt', 'caption', 'alignment', 'width', 'height'], draggable: true, resizable: true, exportable: true },
  { type: 'imageBlock', label: 'Image', category: 'media', editableAttrs: ['src', 'alt', 'caption', 'alignment', 'width', 'height'], draggable: true, resizable: true, exportable: true },
  { type: 'button', label: 'Button', category: 'blocks', editableAttrs: ['label', 'href', 'target', 'variant', 'size'], draggable: true, exportable: true },
  { type: 'callout', label: 'Callout', category: 'blocks', editableText: true, editableAttrs: ['icon', 'variant'], draggable: true, aiEnabled: true, exportable: true },
  { type: 'section', label: 'Section', category: 'layout', allowedChildren: ['block'], editableAttrs: ['variant', 'paddingY', 'background'], draggable: true, exportable: true },
  { type: 'flexRow', label: 'Flex row', category: 'layout', allowedChildren: ['flexColumn'], editableAttrs: ['gap', 'align', 'justify', 'responsive'], draggable: true, exportable: true },
  { type: 'flexColumn', label: 'Flex column', category: 'layout', allowedChildren: ['block'], editableAttrs: ['width'], exportable: true },
  { type: 'spacer', label: 'Spacer', category: 'layout', editableAttrs: ['height'], draggable: true, exportable: true },
  { type: 'hero', label: 'Hero', category: 'blocks', editableText: true, editableAttrs: ['variant', 'background', 'minHeight'], draggable: true, aiEnabled: true, exportable: true },
  { type: 'faq', label: 'FAQ', category: 'blocks', editableText: true, draggable: true, aiEnabled: true, exportable: true },
  { type: 'embed', label: 'Embed', category: 'media', editableAttrs: ['url', 'height', 'aspectRatio'], draggable: true, exportable: true },
];

export const blockRegistry = new Map<string, BlockDefinition>(
  BUILT_IN_BLOCK_DEFINITIONS.map((def) => [def.type, def]),
);

export function registerBlock(def: BlockDefinition): void {
  blockRegistry.set(def.type, def);
}

export function getBlockDef(type: string): BlockDefinition | undefined {
  return blockRegistry.get(type);
}

export function isBlockAllowed(type: string, allowed?: string[], disallowed?: string[]): boolean {
  if (disallowed?.includes(type)) return false;
  if (allowed && !allowed.includes(type)) return false;
  return true;
}
