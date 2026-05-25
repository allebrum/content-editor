import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      icon: { default: 'ℹ️' },
      variant: { default: 'info' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: `ae-callout ae-callout--${HTMLAttributes.variant || 'info'}`,
      }),
      ['span', { class: 'ae-callout__icon', 'aria-hidden': 'true' }, HTMLAttributes.icon || ''],
      ['div', { class: 'ae-callout__content' }, 0],
    ];
  },

  addCommands() {
    return {
      insertCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { id: crypto.randomUUID(), ...attrs },
            content: [{ type: 'paragraph' }],
          }),
    };
  },
});
