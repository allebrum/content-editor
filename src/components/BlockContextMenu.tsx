import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import {
  LuType, LuHeading1, LuHeading2, LuHeading3, LuHeading4,
  LuQuote, LuBell, LuList, LuListOrdered, LuClipboardCheck,
  LuTrash2, LuCopy, LuPlus,
  LuColumns2, LuColumns3,
  LuAlignStartVertical, LuAlignCenterVertical, LuAlignEndVertical, LuMoveVertical,
  LuSmartphone, LuMonitor,
  LuLayoutTemplate, LuImage,
} from 'react-icons/lu';
import type { AssetConfig } from '../schema/types';
import { pickImageAsset } from '../utils/imagePicker';

interface BlockContextMenuProps {
  editor: Editor;
  node: PmNode;
  pos: number;
  x: number;
  y: number;
  assets?: AssetConfig;
  onClose: () => void;
}

type MenuEntry = {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  action: () => void;
  active?: boolean;
  danger?: boolean;
};

type MenuSection = {
  heading?: string;
  items: MenuEntry[];
};

export function BlockContextMenu({ editor, node, pos, x, y, assets, onClose }: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', onMouse);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const exec = useCallback((fn: () => void) => { fn(); onClose(); }, [onClose]);

  // ── ProseMirror helpers ────────────────────────────────────────────────────
  const deleteBlock = useCallback(() => {
    const n = editor.state.doc.nodeAt(pos);
    if (!n) return;
    const { tr } = editor.state;
    tr.delete(pos, pos + n.nodeSize);
    editor.view.dispatch(tr);
  }, [editor, pos]);

  const duplicateBlock = useCallback(() => {
    const n = editor.state.doc.nodeAt(pos);
    if (!n) return;
    const { tr } = editor.state;
    tr.insert(pos + n.nodeSize, n);
    editor.view.dispatch(tr);
    editor.commands.focus();
  }, [editor, pos]);

  const setNodeType = useCallback((typeName: string, attrs: Record<string, unknown> = {}) => {
    const { tr, schema } = editor.state;
    const type = schema.nodes[typeName];
    if (!type) return;
    tr.setNodeMarkup(pos, type, attrs);
    editor.view.dispatch(tr);
    editor.commands.focus();
  }, [editor, pos]);

  const setAttr = useCallback((attrs: Record<string, unknown>) => {
    const { tr } = editor.state;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
    editor.view.dispatch(tr);
  }, [editor, pos, node.attrs]);

  const setAttrsAtPos = useCallback((targetPos: number, targetNode: PmNode, attrs: Record<string, unknown>) => {
    const { tr } = editor.state;
    tr.setNodeMarkup(targetPos, undefined, { ...targetNode.attrs, ...attrs });
    editor.view.dispatch(tr);
  }, [editor]);

  // ── Build section list ─────────────────────────────────────────────────────
  const sections: MenuSection[] = [];
  const nodeType = node.type.name;

  const TEXT_TYPES = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList'];
  const isText = TEXT_TYPES.includes(nodeType);
  const isLayout = nodeType === 'flexRow';
  const isColumn = nodeType === 'flexColumn';
  const isSection = nodeType === 'section';
  const rowColumnColors = ['#ffffff', '#f8fafc', '#eff6ff', '#fef3c7', '#ecfeff', '#fce7f3'];

  if (isText) {
    sections.push({
      heading: 'Turn into',
      items: [
        {
          label: 'Text',
          icon: LuType,
          active: nodeType === 'paragraph',
          action: () => setNodeType('paragraph'),
        },
        {
          label: 'Heading 1',
          icon: LuHeading1,
          active: nodeType === 'heading' && node.attrs.level === 1,
          action: () => setNodeType('heading', { level: 1 }),
        },
        {
          label: 'Heading 2',
          icon: LuHeading2,
          active: nodeType === 'heading' && node.attrs.level === 2,
          action: () => setNodeType('heading', { level: 2 }),
        },
        {
          label: 'Heading 3',
          icon: LuHeading3,
          active: nodeType === 'heading' && node.attrs.level === 3,
          action: () => setNodeType('heading', { level: 3 }),
        },
        {
          label: 'Heading 4',
          icon: LuHeading4,
          active: nodeType === 'heading' && node.attrs.level === 4,
          action: () => setNodeType('heading', { level: 4 }),
        },
        {
          label: 'Quote',
          icon: LuQuote,
          active: nodeType === 'blockquote',
          action: () => setNodeType('blockquote'),
        },
        {
          label: 'Bullet list',
          icon: LuList,
          active: nodeType === 'bulletList',
          action: () => setNodeType('bulletList'),
        },
        {
          label: 'Numbered list',
          icon: LuListOrdered,
          active: nodeType === 'orderedList',
          action: () => setNodeType('orderedList'),
        },
        {
          label: 'Task list',
          icon: LuClipboardCheck,
          active: nodeType === 'taskList',
          action: () => setNodeType('taskList'),
        },
        {
          label: 'Callout',
          icon: LuBell,
          active: nodeType === 'callout',
          action: () => setNodeType('callout'),
        },
      ],
    });
  }

  if (isLayout) {
    const colCount = node.childCount;
    const selected = getSelectedColumnInRow(editor, pos, node);
    const widthSignature = getRowWidthSignature(node);
    sections.push({
      heading: 'Columns',
      items: [
        {
          label: '2 columns - equal',
          icon: LuColumns2,
          active: colCount === 2 && widthSignature === 'auto,auto',
          action: () => exec(() => applyRowPreset(editor, pos, node, ['auto', 'auto'])),
        },
        {
          label: '2 columns - left',
          icon: LuColumns2,
          active: colCount === 2 && widthSignature === '66,33',
          action: () => exec(() => applyRowPreset(editor, pos, node, ['66', '33'])),
        },
        {
          label: '2 columns - right',
          icon: LuColumns2,
          active: colCount === 2 && widthSignature === '33,66',
          action: () => exec(() => applyRowPreset(editor, pos, node, ['33', '66'])),
        },
        {
          label: '3 columns',
          icon: LuColumns3,
          active: colCount === 3,
          action: () => exec(() => applyRowPreset(editor, pos, node, ['auto', 'auto', 'auto'])),
        },
        {
          label: '4 columns',
          icon: LuColumns3,
          active: colCount === 4,
          action: () => exec(() => applyRowPreset(editor, pos, node, ['auto', 'auto', 'auto', 'auto'])),
        },
        {
          label: '5 columns',
          icon: LuColumns3,
          active: colCount === 5,
          action: () => exec(() => applyRowPreset(editor, pos, node, ['auto', 'auto', 'auto', 'auto', 'auto'])),
        },
        {
          label: '6 columns',
          icon: LuColumns3,
          active: colCount === 6,
          action: () => exec(() => applyRowPreset(editor, pos, node, ['auto', 'auto', 'auto', 'auto', 'auto', 'auto'])),
        },
        {
          label: 'Add column',
          icon: LuPlus,
          active: false,
          action: () => exec(() => insertColumn(editor, pos, node, node.childCount)),
        },
      ],
    });

    sections.push({
      heading: 'Vertical align',
      items: [
        {
          label: 'Top',
          icon: LuAlignStartVertical,
          active: node.attrs.align === 'start' || (!node.attrs.align && true),
          action: () => setAttr({ align: 'start' }),
        },
        {
          label: 'Center',
          icon: LuAlignCenterVertical,
          active: node.attrs.align === 'center',
          action: () => setAttr({ align: 'center' }),
        },
        {
          label: 'Bottom',
          icon: LuAlignEndVertical,
          active: node.attrs.align === 'end',
          action: () => setAttr({ align: 'end' }),
        },
        {
          label: 'Stretch',
          icon: LuMoveVertical,
          active: node.attrs.align === 'stretch',
          action: () => setAttr({ align: 'stretch' }),
        },
      ],
    });

    sections.push({
      heading: 'Horizontal distribution',
      items: [
        {
          label: 'Start',
          icon: LuAlignStartVertical,
          active: (node.attrs.justify ?? 'start') === 'start',
          action: () => setAttr({ justify: 'start' }),
        },
        {
          label: 'Center',
          icon: LuAlignCenterVertical,
          active: node.attrs.justify === 'center',
          action: () => setAttr({ justify: 'center' }),
        },
        {
          label: 'Space between',
          icon: LuMoveVertical,
          active: node.attrs.justify === 'between',
          action: () => setAttr({ justify: 'between' }),
        },
      ],
    });

    sections.push({
      heading: 'Mobile',
      items: [
        {
          label: 'Stack on mobile',
          icon: LuSmartphone,
          active: (node.attrs.responsive ?? 'stackOnMobile') === 'stackOnMobile',
          action: () => setAttr({ responsive: 'stackOnMobile' }),
        },
        {
          label: 'Always row',
          icon: LuMonitor,
          active: node.attrs.responsive === 'alwaysRow',
          action: () => setAttr({ responsive: 'alwaysRow' }),
        },
      ],
    });

    sections.push({
      heading: 'Column colors (all)',
      items: [
        ...rowColumnColors.map((color) => ({
          label: color === '#ffffff' ? 'White' : color,
          icon: LuLayoutTemplate,
          active: (node.attrs.columnBackground ?? null) === color,
          action: () => setAttr({ columnBackground: color }),
        })),
        {
          label: 'Clear color',
          icon: LuTrash2,
          active: node.attrs.columnBackground == null,
          action: () => setAttr({ columnBackground: null }),
        },
      ],
    });

    if (selected) {
      sections.push({
        heading: `Selected column (${selected.index + 1})`,
        items: [
          {
            label: 'Auto width',
            icon: LuLayoutTemplate,
            active: (selected.node.attrs.width ?? 'auto') === 'auto',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: 'auto' }),
          },
          {
            label: '25%',
            icon: LuColumns2,
            active: selected.node.attrs.width === '25',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '25' }),
          },
          {
            label: '33%',
            icon: LuColumns3,
            active: selected.node.attrs.width === '33',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '33' }),
          },
          {
            label: '50%',
            icon: LuColumns2,
            active: selected.node.attrs.width === '50',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '50' }),
          },
          {
            label: '66%',
            icon: LuColumns3,
            active: selected.node.attrs.width === '66',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '66' }),
          },
          {
            label: '75%',
            icon: LuColumns2,
            active: selected.node.attrs.width === '75',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '75' }),
          },
          {
            label: '100%',
            icon: LuLayoutTemplate,
            active: selected.node.attrs.width === '100',
            action: () => setAttrsAtPos(selected.pos, selected.node, { width: '100' }),
          },
          {
            label: 'Text left',
            icon: LuAlignStartVertical,
            active: (selected.node.attrs.textAlign ?? 'left') === 'left',
            action: () => setAttrsAtPos(selected.pos, selected.node, { textAlign: 'left' }),
          },
          {
            label: 'Text center',
            icon: LuAlignCenterVertical,
            active: selected.node.attrs.textAlign === 'center',
            action: () => setAttrsAtPos(selected.pos, selected.node, { textAlign: 'center' }),
          },
          {
            label: 'Text right',
            icon: LuAlignEndVertical,
            active: selected.node.attrs.textAlign === 'right',
            action: () => setAttrsAtPos(selected.pos, selected.node, { textAlign: 'right' }),
          },
          {
            label: 'Top align',
            icon: LuAlignStartVertical,
            active: (selected.node.attrs.verticalAlign ?? 'stretch') === 'start',
            action: () => setAttrsAtPos(selected.pos, selected.node, { verticalAlign: 'start' }),
          },
          {
            label: 'Middle align',
            icon: LuAlignCenterVertical,
            active: selected.node.attrs.verticalAlign === 'center',
            action: () => setAttrsAtPos(selected.pos, selected.node, { verticalAlign: 'center' }),
          },
          {
            label: 'Bottom align',
            icon: LuAlignEndVertical,
            active: selected.node.attrs.verticalAlign === 'end',
            action: () => setAttrsAtPos(selected.pos, selected.node, { verticalAlign: 'end' }),
          },
          {
            label: 'Stretch align',
            icon: LuMoveVertical,
            active: selected.node.attrs.verticalAlign === 'stretch',
            action: () => setAttrsAtPos(selected.pos, selected.node, { verticalAlign: 'stretch' }),
          },
          ...rowColumnColors.map((color) => ({
            label: color === '#ffffff' ? 'Column white' : `Column ${color}`,
            icon: LuLayoutTemplate,
            active: (selected.node.attrs.background ?? null) === color,
            action: () => setAttrsAtPos(selected.pos, selected.node, { background: color }),
          })),
          {
            label: 'Clear column color',
            icon: LuTrash2,
            active: selected.node.attrs.background == null,
            action: () => setAttrsAtPos(selected.pos, selected.node, { background: null }),
          },
          {
            label: 'Duplicate column',
            icon: LuCopy,
            active: false,
            action: () => duplicateColumn(editor, pos, node, selected.index),
          },
          {
            label: 'Add column before',
            icon: LuPlus,
            active: false,
            action: () => insertColumn(editor, pos, node, selected.index),
          },
          {
            label: 'Add column after',
            icon: LuPlus,
            active: false,
            action: () => insertColumn(editor, pos, node, selected.index + 1),
          },
          {
            label: 'Delete column',
            icon: LuTrash2,
            danger: true,
            active: false,
            action: () => deleteColumn(editor, pos, node, selected.index),
          },
        ],
      });
    }
  }

  if (isColumn) {
    const ctx = getColumnContext(editor, pos);
    if (ctx) {
      sections.push({
        heading: 'Column',
        items: [
          {
            label: 'Auto width',
            icon: LuLayoutTemplate,
            active: (node.attrs.width ?? 'auto') === 'auto',
            action: () => setAttr({ width: 'auto' }),
          },
          {
            label: '50%',
            icon: LuColumns2,
            active: node.attrs.width === '50',
            action: () => setAttr({ width: '50' }),
          },
          {
            label: 'Text center',
            icon: LuAlignCenterVertical,
            active: node.attrs.textAlign === 'center',
            action: () => setAttr({ textAlign: 'center' }),
          },
          {
            label: 'Duplicate column',
            icon: LuCopy,
            action: () => duplicateColumn(editor, ctx.rowPos, ctx.rowNode, ctx.index),
          },
          {
            label: 'Add column before',
            icon: LuPlus,
            action: () => insertColumn(editor, ctx.rowPos, ctx.rowNode, ctx.index),
          },
          {
            label: 'Add column after',
            icon: LuPlus,
            action: () => insertColumn(editor, ctx.rowPos, ctx.rowNode, ctx.index + 1),
          },
          {
            label: 'Delete column',
            icon: LuTrash2,
            danger: true,
            action: () => deleteColumn(editor, ctx.rowPos, ctx.rowNode, ctx.index),
          },
        ],
      });
    }
  }

  if (isSection) {
    const currentBackground = node.attrs.background as { type?: string; color?: string; imageUrl?: string } | null;
    const bgType = currentBackground?.type ?? 'none';
    const bgColor = currentBackground?.color ?? '';

    const setBackgroundColor = (color: string) => {
      setAttr({ background: { type: 'color', color } });
    };

    const setBackgroundImage = async () => {
      const picked = await pickImageAsset(assets, {
        kind: 'image',
        context: 'section-background',
        currentUrl: currentBackground?.imageUrl ?? '',
      });
      if (!picked?.url) return;
      setAttr({ background: { type: 'image', imageUrl: picked.url, opacity: 0.2 } });
    };

    sections.push({
      heading: 'Section width',
      items: [
        {
          label: 'Default width',
          icon: LuLayoutTemplate,
          active: (node.attrs.variant ?? 'default') === 'default',
          action: () => setAttr({ variant: 'default' }),
        },
        {
          label: 'Narrow',
          icon: LuColumns2,
          active: node.attrs.variant === 'narrow',
          action: () => setAttr({ variant: 'narrow' }),
        },
        {
          label: 'Wide',
          icon: LuColumns3,
          active: node.attrs.variant === 'wide',
          action: () => setAttr({ variant: 'wide' }),
        },
      ],
    });

    sections.push({
      heading: 'Section background',
      items: [
        {
          label: 'White',
          icon: LuType,
          active: bgType === 'none' || (bgType === 'color' && bgColor === '#ffffff'),
          action: () => setAttr({ background: { type: 'none' } }),
        },
        {
          label: 'Soft blue',
          icon: LuType,
          active: bgType === 'color' && bgColor === '#eff6ff',
          action: () => setBackgroundColor('#eff6ff'),
        },
        {
          label: 'Soft gray',
          icon: LuType,
          active: bgType === 'color' && bgColor === '#f8fafc',
          action: () => setBackgroundColor('#f8fafc'),
        },
        {
          label: 'Soft peach',
          icon: LuType,
          active: bgType === 'color' && bgColor === '#fff7ed',
          action: () => setBackgroundColor('#fff7ed'),
        },
        {
          label: 'Background image…',
          icon: LuImage,
          active: bgType === 'image',
          action: setBackgroundImage,
        },
        {
          label: 'Clear background',
          icon: LuTrash2,
          active: false,
          action: () => setAttr({ background: { type: 'none' } }),
        },
      ],
    });

    sections.push({
      heading: 'Spacing',
      items: [
        {
          label: 'Compact',
          icon: LuAlignCenterVertical,
          active: node.attrs.paddingY === 'sm',
          action: () => setAttr({ paddingY: 'sm' }),
        },
        {
          label: 'Comfortable',
          icon: LuAlignCenterVertical,
          active: (node.attrs.paddingY ?? 'md') === 'md',
          action: () => setAttr({ paddingY: 'md' }),
        },
        {
          label: 'Spacious',
          icon: LuAlignCenterVertical,
          active: node.attrs.paddingY === 'lg' || node.attrs.paddingY === 'xl',
          action: () => setAttr({ paddingY: 'lg' }),
        },
      ],
    });
  }

  // Actions for all blocks
  sections.push({
    items: [
      {
        label: 'Duplicate',
        icon: LuCopy,
        action: duplicateBlock,
      },
      {
        label: 'Delete',
        icon: LuTrash2,
        danger: true,
        action: deleteBlock,
      },
    ],
  });

  // ── Position: clamp within viewport ───────────────────────────────────────
  const estHeight = sections.reduce((h, s) => h + (s.heading ? 24 : 0) + s.items.length * 34 + 8, 8);
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x + 6, window.innerWidth - 224),
    top: Math.max(8, Math.min(y, window.innerHeight - estHeight - 8)),
    zIndex: 9999,
  };

  return createPortal(
    <div ref={menuRef} className="ae-block-menu" style={menuStyle}>
      {sections.map((section, si) => (
        <div key={si} className={`ae-block-menu__section${si > 0 && !sections[si - 1].heading && !section.heading ? '' : ''}`}>
          {section.heading && (
            <div className="ae-block-menu__heading">{section.heading}</div>
          )}
          {si > 0 && <div className="ae-block-menu__divider" />}
          {section.items.map((item) => (
            <button
              key={item.label}
              className={[
                'ae-block-menu__item',
                item.active ? 'ae-block-menu__item--active' : '',
                item.danger ? 'ae-block-menu__item--danger' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => exec(item.action)}
            >
              <item.icon size={13} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function getRowWidthSignature(node: PmNode): string {
  return Array.from({ length: node.childCount }, (_, i) => String(node.child(i).attrs.width ?? 'auto')).join(',');
}

type RowColumnInfo = {
  rowPos: number;
  rowNode: PmNode;
  pos: number;
  node: PmNode;
  index: number;
};

function getSelectedColumnInRow(editor: Editor, rowPos: number, rowNode: PmNode): RowColumnInfo | null {
  const selectionPos = editor.state.selection.from;
  let colPos = rowPos + 1;
  let fallback: RowColumnInfo | null = null;
  for (let i = 0; i < rowNode.childCount; i++) {
    const colNode = rowNode.child(i);
    const from = colPos;
    const to = colPos + colNode.nodeSize;
    const current: RowColumnInfo = { rowPos, rowNode, pos: colPos, node: colNode, index: i };
    if (!fallback) fallback = current;
    if (selectionPos >= from && selectionPos <= to) return current;
    colPos = to;
  }
  return fallback;
}

function getColumnContext(editor: Editor, colPos: number): { rowPos: number; rowNode: PmNode; index: number } | null {
  try {
    const $pos = editor.state.doc.resolve(colPos);
    for (let d = $pos.depth; d >= 1; d--) {
      if ($pos.node(d).type.name !== 'flexColumn') continue;
      const rowDepth = d - 1;
      if (rowDepth < 1 || $pos.node(rowDepth).type.name !== 'flexRow') continue;
      const rowPos = $pos.before(rowDepth);
      const rowNode = editor.state.doc.nodeAt(rowPos);
      if (!rowNode) return null;
      let offset = rowPos + 1;
      for (let i = 0; i < rowNode.childCount; i++) {
        if (offset === $pos.before(d)) return { rowPos, rowNode, index: i };
        offset += rowNode.child(i).nodeSize;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function applyRowPreset(editor: Editor, pos: number, node: PmNode, widths: Array<'auto' | '25' | '33' | '50' | '66' | '75' | '100'>) {
  adjustColumns(editor, pos, node, widths.length);
  const updated = editor.state.doc.nodeAt(pos);
  if (!updated || updated.type.name !== 'flexRow') return;
  const { tr } = editor.state;
  let colPos = pos + 1;
  for (let i = 0; i < updated.childCount; i++) {
    const colNode = updated.child(i);
    tr.setNodeMarkup(colPos, undefined, { ...colNode.attrs, width: widths[i] ?? 'auto' });
    colPos += colNode.nodeSize;
  }
  editor.view.dispatch(tr);
}

// ── Adjust column count of a flexRow ─────────────────────────────────────────
function adjustColumns(editor: Editor, pos: number, node: PmNode, targetCount: number) {
  const boundedTarget = Math.max(1, Math.min(6, targetCount));
  const { tr, schema } = editor.state;
  const colType = schema.nodes.flexColumn;
  if (!colType) return;

  const currentCount = node.childCount;
  if (currentCount === boundedTarget) return;

  if (boundedTarget > currentCount) {
    // Add columns before the closing of flexRow (pos + nodeSize - 1)
    const toAdd = boundedTarget - currentCount;
    const newCol = colType.create({ id: crypto.randomUUID(), width: 'auto' }, schema.nodes.paragraph.create());
    const insertAt = pos + node.nodeSize - 1;
    for (let i = 0; i < toAdd; i++) {
      tr.insert(insertAt + i * newCol.nodeSize, newCol);
    }
  } else {
    // Remove columns from the right (go right-to-left to preserve positions)
    const colStarts: number[] = [];
    let offset = pos + 1;
    for (let i = 0; i < currentCount; i++) {
      colStarts.push(offset);
      offset += node.child(i).nodeSize;
    }
    for (let i = currentCount - 1; i >= boundedTarget; i--) {
      tr.delete(colStarts[i], colStarts[i] + node.child(i).nodeSize);
    }
  }

  editor.view.dispatch(tr);
}

function insertColumn(editor: Editor, rowPos: number, rowNode: PmNode, index: number) {
  if (rowNode.childCount >= 6) return;
  const { tr, schema } = editor.state;
  const colType = schema.nodes.flexColumn;
  const paraType = schema.nodes.paragraph;
  if (!colType || !paraType) return;
  let insertAt = rowPos + 1;
  for (let i = 0; i < Math.max(0, Math.min(index, rowNode.childCount)); i++) {
    insertAt += rowNode.child(i).nodeSize;
  }
  const newCol = colType.create({ id: crypto.randomUUID(), width: 'auto' }, paraType.create());
  tr.insert(insertAt, newCol);
  editor.view.dispatch(tr);
}

function duplicateColumn(editor: Editor, rowPos: number, rowNode: PmNode, index: number) {
  if (rowNode.childCount >= 6 || index < 0 || index >= rowNode.childCount) return;
  const { tr } = editor.state;
  let insertAt = rowPos + 1;
  for (let i = 0; i <= index; i++) {
    insertAt += rowNode.child(i).nodeSize;
  }
  tr.insert(insertAt, rowNode.child(index));
  editor.view.dispatch(tr);
}

function deleteColumn(editor: Editor, rowPos: number, rowNode: PmNode, index: number) {
  if (rowNode.childCount <= 1 || index < 0 || index >= rowNode.childCount) return;
  const { tr } = editor.state;
  let colStart = rowPos + 1;
  for (let i = 0; i < index; i++) {
    colStart += rowNode.child(i).nodeSize;
  }
  const colSize = rowNode.child(index).nodeSize;
  tr.delete(colStart, colStart + colSize);
  editor.view.dispatch(tr);
}
