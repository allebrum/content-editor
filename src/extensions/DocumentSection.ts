import { Node, mergeAttributes } from '@tiptap/core';
import { sectionBackgroundToCssValue } from '../utils/sectionBackground';

export interface SectionOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    section: {
      insertSection: (attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

export const DocumentSection = Node.create<SectionOptions>({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      id: { default: null },
      variant: { default: 'default' },
      paddingY: { default: 'md' },
      background: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-background');
          return raw ? JSON.parse(raw) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.background) return {};
          return { 'data-background': JSON.stringify(attrs.background) };
        },
      },
      backdrop: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-backdrop');
          return raw ? JSON.parse(raw) : null;
        },
        renderHTML: (attrs) => {
          if (!attrs.backdrop) return {};
          return { 'data-backdrop': JSON.stringify(attrs.backdrop) };
        },
      },
      fullBleed: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-full-bleed') !== 'false',
        renderHTML: (attrs) => ({ 'data-full-bleed': attrs.fullBleed === false ? 'false' : 'true' }),
      },
      contentAlign: {
        default: 'top',
      },
      cardWidth: {
        default: 'md',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-type="section"]', contentElement: '.ae-section__card' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = (node?.attrs ?? {}) as Record<string, unknown>;
    const cardBg = sectionBackgroundToCssValue(attrs.background as Record<string, unknown>);
    const backdropBg = sectionBackgroundToCssValue(attrs.backdrop as Record<string, unknown>);

    // Outer section: carries backdrop bg + data attrs for CSS targeting
    const outerStyle = backdropBg ? `--ae-section-backdrop-bg:${backdropBg};` : '';
    const outerAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'section',
      'data-card-width': attrs.cardWidth ?? 'md',
      'data-content-align': attrs.contentAlign ?? 'top',
      'data-full-bleed': attrs.fullBleed === false ? 'false' : 'true',
      class: 'ae-section',
      ...(outerStyle ? { style: outerStyle } : {}),
    });

    // Inner card div: carries card width, padding, card bg, alignment
    const innerStyle = cardBg ? `--ae-section-card-bg:${cardBg};` : '';
    const widthClass =
      attrs.cardWidth === 'sm' ? 'ae-section__card--narrow' : attrs.cardWidth === 'lg' ? 'ae-section__card--wide' : '';
    const innerClasses = [
      'ae-section__card',
      widthClass,
      attrs.paddingY ? `ae-py-${String(attrs.paddingY)}` : '',
      attrs.fullBleed === false ? 'ae-section__card--raised' : 'ae-section__card--fullBleed',
      attrs.contentAlign ? `ae-section--content-${String(attrs.contentAlign)}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return ['section', outerAttrs, ['div', { class: innerClasses, ...(innerStyle ? { style: innerStyle } : {}) }, 0]];
  },

  addCommands() {
    return {
      insertSection:
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
