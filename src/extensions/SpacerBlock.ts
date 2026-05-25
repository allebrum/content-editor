import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spacer: {
      insertSpacer: (size?: 'sm' | 'md' | 'lg' | 'xl') => ReturnType;
    };
  }
}

export const SpacerBlock = Node.create({
  name: 'spacer',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      height: { default: 'md' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="spacer"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'spacer',
        class: `ae-spacer ae-spacer--${HTMLAttributes.height || 'md'}`,
        'aria-hidden': 'true',
      }),
    ];
  },

  addCommands() {
    return {
      insertSpacer:
        (size = 'md') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { height: size } }),
    };
  },
});
