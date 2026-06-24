import { Node, mergeAttributes, type RawCommands } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

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
      textAlign: { default: 'left' },
      verticalAlign: { default: 'stretch' },
      background: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flex-column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const {
      width: _width,
      textAlign: _textAlign,
      verticalAlign: _verticalAlign,
      background: _background,
      ...domAttrs
    } = attrs;
    const widthClass = attrs.width && attrs.width !== 'auto'
      ? `ae-col--${attrs.width}`
      : 'ae-col--auto';
    const textAlignClass = attrs.textAlign ? `ae-col--text-${attrs.textAlign}` : '';
    const verticalAlignClass = attrs.verticalAlign ? `ae-col--valign-${attrs.verticalAlign}` : '';
    const styleParts: string[] = [];
    if (typeof attrs.background === 'string' && attrs.background) {
      styleParts.push(`--ae-col-bg:${attrs.background}`);
    }
    const style = styleParts.join(';');
    return [
      'div',
      mergeAttributes(domAttrs, {
        'data-type': 'flex-column',
        ...(typeof attrs.background === 'string' && attrs.background ? { 'data-col-bg': attrs.background } : {}),
        class: ['ae-col', widthClass, textAlignClass, verticalAlignClass].filter(Boolean).join(' '),
        ...(textAlignClass ? { 'data-col-text-align': attrs.textAlign } : {}),
        ...(verticalAlignClass ? { 'data-col-vertical-align': attrs.verticalAlign } : {}),
        ...(style ? { style } : {}),
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor;
        const { selection } = state;
        if (!selection.empty) return false;

        const { $from } = selection;
        let columnDepth = -1;
        for (let d = $from.depth; d >= 1; d--) {
          if ($from.node(d).type.name === 'flexColumn') {
            columnDepth = d;
            break;
          }
        }
        if (columnDepth < 1) return false;

        const rowDepth = columnDepth - 1;
        if (rowDepth < 1 || $from.node(rowDepth).type.name !== 'flexRow') return false;

        const columnNode = $from.node(columnDepth);
        const isEmptyColumn =
          columnNode.childCount === 1 &&
          columnNode.firstChild?.type.name === 'paragraph' &&
          columnNode.firstChild.content.size === 0;
        if (!isEmptyColumn) return false;

        const rowNode = $from.node(rowDepth);
        if (rowNode.childCount <= 1) return false;

        const columnPos = $from.before(columnDepth);
        const tr = state.tr.delete(columnPos, columnPos + columnNode.nodeSize);

        const nextPos = Math.max(0, Math.min(tr.doc.content.size, tr.mapping.map(columnPos, -1)));
        tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos), -1));
        view.dispatch(tr);
        return true;
      },
    };
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
      columnBackground: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="flex-row"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const {
      gap: _gap,
      align: _align,
      justify: _justify,
      responsive: _responsive,
      columnBackground: _columnBackground,
      ...domAttrs
    } = attrs;
    const alignClass = attrs.align ? `ae-row--align-${attrs.align}` : '';
    const justifyClass = attrs.justify ? `ae-row--justify-${attrs.justify}` : '';
    const styleParts: string[] = [];
    if (typeof attrs.columnBackground === 'string' && attrs.columnBackground) {
      styleParts.push(`--ae-row-col-bg:${attrs.columnBackground}`);
    }
    const style = styleParts.join(';');
    return [
      'div',
      mergeAttributes(domAttrs, {
        'data-type': 'flex-row',
        ...(typeof attrs.columnBackground === 'string' && attrs.columnBackground ? { 'data-row-col-bg': attrs.columnBackground } : {}),
        class: [
          'ae-row',
          attrs.gap ? `ae-row--gap-${attrs.gap}` : '',
          alignClass,
          justifyClass,
          attrs.responsive === 'stackOnMobile' ? 'ae-row--stack-mobile' : '',
        ]
          .filter(Boolean)
          .join(' '),
        ...(style ? { style } : {}),
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
