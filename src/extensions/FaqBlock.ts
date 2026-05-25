import { Node, mergeAttributes } from '@tiptap/core';

export const FaqBlock = Node.create({
  name: 'faq',
  group: 'block',
  content: 'faqItem+',
  defining: true,

  addAttributes() {
    return { id: { default: null } };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="faq"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'faq', class: 'ae-faq' }),
      0,
    ];
  },
});

export const FaqItem = Node.create({
  name: 'faqItem',
  group: 'block',
  content: 'heading block+',
  defining: true,

  addAttributes() {
    return { id: { default: null }, open: { default: false } };
  },

  parseHTML() {
    return [{ tag: 'details[data-type="faq-item"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, { 'data-type': 'faq-item', class: 'ae-faq__item' }),
      0,
    ];
  },
});
