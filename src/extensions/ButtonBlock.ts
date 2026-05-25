import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    button: {
      insertButton: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

export const ButtonBlock = Node.create({
  name: 'button',
  group: 'block',
  inline: false,
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      label: { default: 'Click here' },
      href: { default: '#' },
      target: { default: '_self' },
      variant: { default: 'primary' },
      size: { default: 'md' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="button"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'button',
        class: 'ae-button-wrap',
      }),
      [
        'a',
        {
          href: HTMLAttributes.href,
          target: HTMLAttributes.target,
          class: [
            'ae-button',
            `ae-button--${HTMLAttributes.variant || 'primary'}`,
            `ae-button--${HTMLAttributes.size || 'md'}`,
          ].join(' '),
        },
        String(HTMLAttributes.label || 'Click here'),
      ],
    ];
  },

  addCommands() {
    return {
      insertButton:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { id: crypto.randomUUID(), label: 'Click here', href: '#', ...attrs },
          }),
    };
  },
});
