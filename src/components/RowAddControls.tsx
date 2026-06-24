import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { LuPlus } from 'react-icons/lu';

type HoveredRow = {
  pos: number;
  node: PmNode;
  rect: DOMRect;
};

export function RowAddControls({ editor }: { editor: Editor }) {
  const [hovered, setHovered] = useState<HoveredRow | null>(null);
  const hoveredRef = useRef<HoveredRow | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  const getRowAt = useCallback((clientX: number, clientY: number): HoveredRow | null => {
    const at = editor.view.posAtCoords({ left: clientX, top: clientY });
    if (!at) return null;
    try {
      const $pos = editor.state.doc.resolve(at.pos);
      for (let d = $pos.depth; d >= 1; d--) {
        if ($pos.node(d).type.name !== 'flexRow') continue;
        const rowPos = $pos.before(d);
        const node = editor.state.doc.nodeAt(rowPos);
        const dom = editor.view.nodeDOM(rowPos);
        if (!node || !(dom instanceof Element)) return null;
        return { pos: rowPos, node, rect: dom.getBoundingClientRect() };
      }
    } catch {
      return null;
    }
    return null;
  }, [editor]);

  useEffect(() => {
    const container = editor.view.dom.closest('.ae-editor-root') as HTMLElement | null;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (!container.contains(e.target as Node)) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setHovered(null), 250);
        return;
      }
      clearTimeout(hideTimerRef.current);
      const row = getRowAt(e.clientX, e.clientY);
      if (!row || row.node.childCount >= 6) {
        setHovered(null);
        return;
      }
      setHovered(row);
    };

    const onScroll = () => {
      const current = hoveredRef.current;
      if (!current) return;
      const dom = editor.view.nodeDOM(current.pos);
      if (!(dom instanceof Element)) {
        setHovered(null);
        return;
      }
      setHovered({ ...current, rect: dom.getBoundingClientRect() });
    };

    document.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(hideTimerRef.current);
    };
  }, [editor, getRowAt]);

  const onAdd = useCallback(() => {
    const current = hoveredRef.current;
    if (!current || current.node.childCount >= 6) return;
    const colType = editor.state.schema.nodes.flexColumn;
    const paraType = editor.state.schema.nodes.paragraph;
    if (!colType || !paraType) return;
    const insertAt = current.pos + current.node.nodeSize - 1;
    const tr = editor.state.tr.insert(
      insertAt,
      colType.create(
        { id: crypto.randomUUID(), width: 'auto' },
        paraType.create(),
      ),
    );
    editor.view.dispatch(tr);
    editor.commands.focus();
  }, [editor]);

  if (!hovered) return null;

  return createPortal(
    <button
      className="ae-row-add-btn"
      style={{
        top: hovered.rect.top + hovered.rect.height / 2 - 18,
        left: hovered.rect.right - 18,
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAdd}
      title="Add column"
      aria-label="Add column"
    >
      <LuPlus size={18} />
    </button>,
    document.body,
  );
}
