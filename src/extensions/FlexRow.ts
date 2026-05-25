import { Node, mergeAttributes, type RawCommands } from '@tiptap/core';

export const FlexColumn = Node.create({
  name: 'flexColumn',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: { default: null },
      width: { default: 'auto' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flex-column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const widthClass = HTMLAttributes.width && HTMLAttributes.width !== 'auto'
      ? `ae-col--${HTMLAttributes.width}`
      : 'ae-col--auto';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'flex-column',
        class: `ae-col ${widthClass}`,
      }),
      0,
    ];
  },
});

export const FlexRow = Node.create({
  name: 'flexRow',
  group: 'block',
  content: 'flexColumn+',
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      gap: { default: 'md' },
      align: { default: 'stretch' },
      justify: { default: 'start' },
      responsive: { default: 'stackOnMobile' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flex-row"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'flex-row',
        class: [
          'ae-row',
          HTMLAttributes.gap ? `ae-row--gap-${HTMLAttributes.gap}` : '',
          HTMLAttributes.responsive === 'stackOnMobile' ? 'ae-row--stack-mobile' : '',
        ]
          .filter(Boolean)
          .join(' '),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertFlexRow:
        (columns = 2) =>
        ({ commands }: { commands: { insertContent: (c: unknown) => boolean } }) =>
          commands.insertContent({
            type: 'flexRow',
            attrs: { id: crypto.randomUUID() },
            content: Array.from({ length: columns }, () => ({
              type: 'flexColumn',
              attrs: { id: crypto.randomUUID(), width: 'auto' },
              content: [{ type: 'paragraph' }],
            })),
          }) as boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});
