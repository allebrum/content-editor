import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { SlashCommandItem } from '../schema/types';

export type SlashCommandOptions = {
  commands: SlashCommandItem[];
  suggestion: Omit<SuggestionOptions, 'editor'>;
};

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      commands: [],
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          (props as SlashCommandItem).insert({ editor });
          editor.chain().focus().deleteRange(range).run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = $from.parent.type;
          return type.name === 'paragraph';
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
