import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImage: (attrs: {
        src: string;
        alt?: string;
        assetId?: string;
        width?: number;
        height?: number;
        alignment?: 'left' | 'center' | 'right';
        caption?: string;
      }) => ReturnType;
    };
  }
}

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      assetId: { default: null, parseHTML: (el) => el.getAttribute('data-asset-id') },
      alignment: { default: 'center' },
      caption: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, alignment, src, alt, title, width, height } = HTMLAttributes;
    const figureAttrs = mergeAttributes(HTMLAttributes, {
      'data-type': 'image-block',
      class: `ae-image-block ae-image-block--${alignment || 'center'}`,
    });

    const imgAttrs: Record<string, unknown> = { src, alt: alt || '', class: 'ae-image' };
    if (title) imgAttrs.title = title;
    if (width) imgAttrs.width = width;
    if (height) imgAttrs.height = height;

    const nodes: unknown[] = ['figure', figureAttrs, ['img', imgAttrs]];
    if (caption) {
      nodes.push(['figcaption', { class: 'ae-image-caption' }, caption]);
    }
    return nodes as unknown as [string, Record<string, unknown>, ...unknown[]];
  },

  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
