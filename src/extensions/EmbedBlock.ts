import { Node, mergeAttributes } from '@tiptap/core';

export const EmbedBlock = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      url: { default: '' },
      provider: { default: null },
      width: { default: '100%' },
      height: { default: 400 },
      aspectRatio: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'embed',
        class: 'ae-embed',
        'data-url': HTMLAttributes.url,
      }),
      ['div', { class: 'ae-embed__placeholder' }, `Embedded: ${HTMLAttributes.url}`],
    ];
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs: Record<string, unknown>) =>
        ({ commands }: { commands: { insertContent: (c: unknown) => boolean } }) =>
          commands.insertContent({
            type: this.name,
            attrs: { id: crypto.randomUUID(), ...attrs },
          }) as boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});
