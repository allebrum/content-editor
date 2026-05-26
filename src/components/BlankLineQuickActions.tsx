import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { AssetConfig } from '../schema/types';
import { LuImage, LuLayoutTemplate, LuPlus } from 'react-icons/lu';
import { pickImageAsset } from '../utils/imagePicker';

type BlankLineTarget = {
  paragraphPos: number;
  paragraphNodeSize: number;
  hostEl: HTMLElement;
  top: number;
  left: number;
};

export function BlankLineQuickActions({ editor, assets }: { editor: Editor; assets?: AssetConfig }) {
  const [tick, setTick] = useState(0);
  const [busyImage, setBusyImage] = useState(false);

  useEffect(() => {
    const onUpdate = () => setTick((v) => v + 1);
    editor.on('transaction', onUpdate);
    editor.on('selectionUpdate', onUpdate);
    editor.on('focus', onUpdate);
    editor.on('blur', onUpdate);
    window.addEventListener('scroll', onUpdate, { passive: true });
    window.addEventListener('resize', onUpdate);
    return () => {
      editor.off('transaction', onUpdate);
      editor.off('selectionUpdate', onUpdate);
      editor.off('focus', onUpdate);
      editor.off('blur', onUpdate);
      window.removeEventListener('scroll', onUpdate);
      window.removeEventListener('resize', onUpdate);
    };
  }, [editor]);

  const target = useMemo<BlankLineTarget | null>(() => {
    if (!editor.isFocused) return null;
    const { selection } = editor.state;
    if (!selection.empty) return null;

    const $from = selection.$from;
    let paragraphDepth = -1;
    for (let d = $from.depth; d >= 1; d--) {
      if ($from.node(d).type.name === 'paragraph') {
        paragraphDepth = d;
        break;
      }
    }
    if (paragraphDepth < 0) return null;

    const paragraphNode = $from.node(paragraphDepth);
    if (paragraphNode.textContent.trim().length > 0) return null;

    const paragraphPos = $from.before(paragraphDepth);
    const paragraphDom = editor.view.nodeDOM(paragraphPos);
    if (!(paragraphDom instanceof Element)) return null;
    const paragraphRect = paragraphDom.getBoundingClientRect();

    const hostEl = editor.view.dom.closest('.ae-editor-root');
    if (!(hostEl instanceof HTMLElement)) return null;
    const hostRect = hostEl.getBoundingClientRect();

    return {
      paragraphPos,
      paragraphNodeSize: paragraphNode.nodeSize,
      hostEl,
      top: Math.max(0, paragraphRect.top - hostRect.top - 3),
      left: Math.max(0, paragraphRect.left - hostRect.left + 8),
    };
  }, [editor, tick]);

  const insertImage = useCallback(async () => {
    if (!target) return;
    setBusyImage(true);
    try {
      const picked = await pickImageAsset(assets, { kind: 'image', context: 'image-block' });
      if (!picked?.url) return;
      const insertAt = target.paragraphPos + target.paragraphNodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(insertAt, {
          type: 'imageBlock',
          attrs: {
            src: picked.url,
            alt: picked.alt ?? '',
            assetId: picked.assetId,
            width: picked.width,
            height: picked.height,
            alignment: 'center',
          },
        })
        .run();
    } finally {
      setBusyImage(false);
    }
  }, [assets, editor, target]);

  const insertTable = useCallback(() => {
    if (!target) return;
    const insertAt = target.paragraphPos + target.paragraphNodeSize;
    editor
      .chain()
      .focus()
      .insertContentAt(insertAt, {
        type: 'flexRow',
        attrs: { id: crypto.randomUUID(), gap: 'md', responsive: 'stackOnMobile' },
        content: [
          {
            type: 'flexColumn',
            attrs: { id: crypto.randomUUID(), width: '50' },
            content: [
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Column 1' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Add details...' }] },
            ],
          },
          {
            type: 'flexColumn',
            attrs: { id: crypto.randomUUID(), width: '50' },
            content: [
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Column 2' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Add details...' }] },
            ],
          },
        ],
      })
      .run();
  }, [editor, target]);

  const addMoreBlocks = useCallback(() => {
    if (!target) return;
    const insertPos = target.paragraphPos + 1;
    const { tr } = editor.state;
    tr.insertText('/', insertPos);
    editor.view.dispatch(tr);
    editor.commands.focus(insertPos + 1);
  }, [editor, target]);

  if (!target) return null;

  return createPortal(
    <div className="ae-inline-quick-actions" style={{ top: target.top, left: target.left }} contentEditable={false}>
      <span>Type <kbd>/</kbd> to add blocks or...</span>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => void insertImage()} disabled={busyImage}>
        <LuImage size={13} />
        <span>Add image</span>
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={insertTable}>
        <LuLayoutTemplate size={13} />
        <span>Add table</span>
      </button>
      <button onMouseDown={(e) => e.preventDefault()} onClick={addMoreBlocks}>
        <LuPlus size={13} />
        <span>Add more blocks</span>
      </button>
    </div>,
    target.hostEl,
  );
}
