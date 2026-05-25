import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SvgGraphicNodeView } from '../components/SvgGraphicNodeView';

export const SvgGraphicBlock = Node.create({
  name: 'svgGraphic',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addStorage() {
    return {
      aiConfig: null as unknown,
    };
  },

  addAttributes() {
    return {
      id:                { default: '' },
      svgContent:        { default: '' },
      prompt:            { default: '' },
      vizData:           { default: '' }, // JSON string of VizData — source of truth for template-based vizs
      visualizationType: { default: 'ideas' },
      width:             { default: '100%' },
      height:            { default: 'auto' },
      generatedBy:       { default: 'ai' },
      createdAt:         { default: () => new Date().toISOString() },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="svg-graphic"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'svg-graphic', class: 'ae-svg-graphic' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SvgGraphicNodeView);
  },

  addCommands() {
    return {
      insertSvgGraphic:
        (attrs: { svgContent: string; prompt?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: 'svgGraphic',
            attrs: {
              id: `svg-${Date.now()}`,
              svgContent: attrs.svgContent,
              prompt: attrs.prompt ?? '',
              createdAt: new Date().toISOString(),
            },
          });
        },
    } as any;
  },
});
