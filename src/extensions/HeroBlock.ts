import { Node, mergeAttributes } from '@tiptap/core';

export const HeroBlock = Node.create({
  name: 'hero',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
      variant: { default: 'centered' },
      minHeight: { default: null },
      background: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-background');
          return raw ? JSON.parse(raw) : null;
        },
        renderHTML: (attrs) =>
          attrs.background ? { 'data-background': JSON.stringify(attrs.background) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-type="hero"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'hero',
        class: `ae-hero ae-hero--${HTMLAttributes.variant || 'centered'}`,
      }),
      ['div', { class: 'ae-hero__inner' }, 0],
    ];
  },

  addCommands() {
    return {
      insertHero:
        (attrs = {}) =>
        ({ commands }: { commands: { insertContent: (c: unknown) => boolean } }) =>
          commands.insertContent({
            type: this.name,
            attrs: { id: crypto.randomUUID(), ...attrs },
            content: [
              { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Your Headline' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Your subtitle or description.' }] },
            ],
          }) as boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});
