import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import {
  LuType, LuHeading1, LuHeading2, LuHeading3, LuHeading4,
  LuQuote, LuBell, LuList, LuListOrdered, LuClipboardCheck,
  LuTrash2, LuCopy,
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

  // ── Build section list ─────────────────────────────────────────────────────
  const sections: MenuSection[] = [];
  const nodeType = node.type.name;

  const TEXT_TYPES = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList'];
  const isText = TEXT_TYPES.includes(nodeType);
  const isLayout = nodeType === 'flexRow';
  const isSection = nodeType === 'section';

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
    sections.push({
      heading: 'Columns',
      items: [
        {
          label: '1 column',
          icon: LuLayoutTemplate,
          active: colCount === 1,
          action: () => exec(() => adjustColumns(editor, pos, node, 1)),
        },
        {
          label: '2 columns',
          icon: LuColumns2,
          active: colCount === 2,
          action: () => exec(() => adjustColumns(editor, pos, node, 2)),
        },
        {
          label: '3 columns',
          icon: LuColumns3,
          active: colCount === 3,
          action: () => exec(() => adjustColumns(editor, pos, node, 3)),
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

// ── Adjust column count of a flexRow ─────────────────────────────────────────
function adjustColumns(editor: Editor, pos: number, node: PmNode, targetCount: number) {
  const { tr, schema } = editor.state;
  const colType = schema.nodes.flexColumn;
  if (!colType) return;

  const currentCount = node.childCount;
  if (currentCount === targetCount) return;

  if (targetCount > currentCount) {
    // Add columns before the closing of flexRow (pos + nodeSize - 1)
    const toAdd = targetCount - currentCount;
    const newCol = colType.create({}, schema.nodes.paragraph.create());
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
    for (let i = currentCount - 1; i >= targetCount; i--) {
      tr.delete(colStarts[i], colStarts[i] + node.child(i).nodeSize);
    }
  }

  editor.view.dispatch(tr);
}
