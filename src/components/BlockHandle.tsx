import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { LuGripVertical } from 'react-icons/lu';
import { BlockContextMenu } from './BlockContextMenu';
import { BLOCK_DRAG_MIME } from '../utils/dragDrop';
import type { AssetConfig } from '../schema/types';

interface BlockInfo {
  domNode: Element;
  pos: number;
  node: PmNode;
  rect: DOMRect;
  parentSectionPos: number | null;
}

interface DropIndicator {
  y: number;
  x: number;
  width: number;
}

export function BlockHandle({ editor, assets }: { editor: Editor; assets?: AssetConfig }) {
  const [hovered, setHovered] = useState<BlockInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const dragSrcRef = useRef<BlockInfo | null>(null);
  const isDraggingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hoveredRef = useRef<BlockInfo | null>(null);

  // Keep ref in sync with state (for event handlers that close over old state)
  useEffect(() => { hoveredRef.current = hovered; }, [hovered]);

  // ── Find blocks under mouse / selection ─────────────────────────────────────
  const getTopLevelBlockAtPos = useCallback((pos: number): BlockInfo | null => {
    const { view } = editor;
    try {
      const $pos = view.state.doc.resolve(pos);
      if ($pos.depth < 1) return null;

      const nodePos = $pos.before(1);
      const node = view.state.doc.nodeAt(nodePos);
      if (!node) return null;

      const dom = view.nodeDOM(nodePos);
      if (!(dom instanceof Element)) return null;

      return { domNode: dom, pos: nodePos, node, rect: dom.getBoundingClientRect(), parentSectionPos: null };
    } catch {
      return null;
    }
  }, [editor]);

  const getSectionAndChildAtPos = useCallback((pos: number): BlockInfo | null => {
    const { view } = editor;
    try {
      const $pos = view.state.doc.resolve(pos);
      let sectionDepth = -1;
      for (let d = $pos.depth; d >= 1; d--) {
        if ($pos.node(d).type.name === 'section') {
          sectionDepth = d;
          break;
        }
      }
      if (sectionDepth < 0 || sectionDepth + 1 > $pos.depth) return null;

      const sectionPos = $pos.before(sectionDepth);
      const childPos = $pos.before(sectionDepth + 1);
      const node = view.state.doc.nodeAt(childPos);
      if (!node || node.type.name === 'section') return null;

      const dom = view.nodeDOM(childPos);
      if (!(dom instanceof Element)) return null;

      return {
        domNode: dom,
        pos: childPos,
        node,
        rect: dom.getBoundingClientRect(),
        parentSectionPos: sectionPos,
      };
    } catch {
      return null;
    }
  }, [editor]);

  const getSectionPosAt = useCallback((pos: number): number | null => {
    try {
      const $pos = editor.view.state.doc.resolve(pos);
      for (let d = $pos.depth; d >= 1; d--) {
        if ($pos.node(d).type.name === 'section') {
          return $pos.before(d);
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [editor]);

  const getBlockAt = useCallback((clientX: number, clientY: number): BlockInfo | null => {
    const { view } = editor;
    const result = view.posAtCoords({ left: clientX, top: clientY });
    if (!result) return null;
    const inSection = getSectionPosAt(result.pos) !== null;
    if (inSection) return getSectionAndChildAtPos(result.pos);
    return getTopLevelBlockAtPos(result.pos);
  }, [editor, getSectionAndChildAtPos, getSectionPosAt, getTopLevelBlockAtPos]);

  const syncHoveredFromSelection = useCallback(() => {
    if (isDraggingRef.current || menuOpen) return;
    const selectionPos = editor.state.selection.from;
    const inSection = getSectionPosAt(selectionPos) !== null;
    const block = inSection
      ? getSectionAndChildAtPos(selectionPos)
      : getTopLevelBlockAtPos(selectionPos);
    if (block) setHovered(block);
  }, [editor, getSectionAndChildAtPos, getSectionPosAt, getTopLevelBlockAtPos, menuOpen]);

  const handleRef = useRef<HTMLDivElement>(null);

  // ── Track mouse globally so the handle stays alive when cursor moves onto it ─
  useEffect(() => {
    const container = editor.view.dom.closest('.ae-editor-root') as HTMLElement | null;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (isDraggingRef.current) return;

      // If the cursor is over the handle itself, keep it alive and do nothing else
      if (handleRef.current && handleRef.current.contains(e.target as Node)) {
        clearTimeout(hideTimerRef.current);
        return;
      }

      // If outside the editor container, start a generous hide timer
      if (!container.contains(e.target as Node)) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setHovered(null), 500);
        return;
      }

      clearTimeout(hideTimerRef.current);
      const block = getBlockAt(e.clientX, e.clientY);
      if (block) {
        setHovered(prev => {
          if (prev?.pos === block.pos) {
            prev.rect = block.rect;
            return prev;
          }
          return block;
        });
      } else {
        hideTimerRef.current = setTimeout(() => setHovered(null), 300);
      }
    };

    // Update rect on scroll
    const onScroll = () => {
      if (hoveredRef.current) {
        const dom = hoveredRef.current.domNode;
        setHovered(prev => prev ? { ...prev, rect: dom.getBoundingClientRect() } : null);
      }
    };

    // Listen on document so we catch cursor moving to the portal handle
    document.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(hideTimerRef.current);
    };
  }, [editor, getBlockAt]);

  // ── Drag-over / drop handlers on the editor DOM ──────────────────────────────
  useEffect(() => {
    const editorDom = editor.view.dom;
    const hasBlockDragPayload = (dt: DataTransfer | null) =>
      !!dt?.types && Array.from(dt.types).includes(BLOCK_DRAG_MIME);

    const calcTopLevelDropTarget = (clientY: number): { insertBefore: number | null; indicatorY: number; x: number; w: number } => {
      const { view } = editor;
      const { doc } = view.state;
      const editorRect = editorDom.getBoundingClientRect();

      let offset = 0;
      for (let i = 0; i < doc.childCount; i++) {
        const child = doc.child(i);
        const dom = view.nodeDOM(offset);
        if (dom instanceof Element) {
          const rect = dom.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            return { insertBefore: offset, indicatorY: rect.top - 1, x: editorRect.left, w: editorRect.width };
          }
        }
        offset += child.nodeSize;
      }

      // Drop after last block
      const lastDom = view.nodeDOM(offset - (doc.lastChild?.nodeSize ?? 0));
      const lastY = lastDom instanceof Element ? lastDom.getBoundingClientRect().bottom : editorRect.bottom;
      return { insertBefore: null, indicatorY: lastY + 1, x: editorRect.left, w: editorRect.width };
    };

    const findTargetSectionPos = (clientX: number, clientY: number): number | null => {
      const at = editor.view.posAtCoords({ left: clientX, top: clientY });
      if (!at) return null;
      try {
        const $pos = editor.state.doc.resolve(at.pos);
        for (let d = $pos.depth; d >= 1; d--) {
          if ($pos.node(d).type.name === 'section') {
            return $pos.before(d);
          }
        }
      } catch {
        return null;
      }
      return null;
    };

    const calcSectionChildDropTarget = (
      clientX: number,
      clientY: number,
      fallbackSectionPos: number,
    ): { sectionPos: number; insertBefore: number | null; indicatorY: number; x: number; w: number } | null => {
      const { view } = editor;
      const sectionPos = findTargetSectionPos(clientX, clientY) ?? fallbackSectionPos;
      const sectionNode = view.state.doc.nodeAt(sectionPos);
      const sectionDom = view.nodeDOM(sectionPos);
      if (!sectionNode || sectionNode.type.name !== 'section' || !(sectionDom instanceof Element)) return null;
      const sectionRect = sectionDom.getBoundingClientRect();

      let offset = sectionPos + 1;
      for (let i = 0; i < sectionNode.childCount; i++) {
        const child = sectionNode.child(i);
        const childDom = view.nodeDOM(offset);
        if (childDom instanceof Element) {
          const rect = childDom.getBoundingClientRect();
          if (clientY < rect.top + rect.height / 2) {
            return { sectionPos, insertBefore: offset, indicatorY: rect.top - 1, x: sectionRect.left, w: sectionRect.width };
          }
        }
        offset += child.nodeSize;
      }

      return {
        sectionPos,
        insertBefore: null,
        indicatorY: sectionRect.bottom - 1,
        x: sectionRect.left,
        w: sectionRect.width,
      };
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasBlockDragPayload(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer!.dropEffect = 'move';
      const src = dragSrcRef.current;
      if (src && src.parentSectionPos !== null) {
        const target = calcSectionChildDropTarget(e.clientX, e.clientY, src.parentSectionPos);
        if (target) setDropIndicator({ y: target.indicatorY, x: target.x, width: target.w });
        return;
      }
      const { indicatorY, x, w } = calcTopLevelDropTarget(e.clientY);
      setDropIndicator({ y: indicatorY, x, width: w });
    };

    const onDrop = (e: DragEvent) => {
      if (!hasBlockDragPayload(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();

      let src = dragSrcRef.current;
      if (!src) {
        const raw = e.dataTransfer?.getData(BLOCK_DRAG_MIME);
        const parsedPos = raw ? Number(raw) : NaN;
        if (!Number.isNaN(parsedPos)) {
          src = getTopLevelBlockAtPos(parsedPos);
        }
      }
      if (!src) {
        cleanup();
        return;
      }
      const { view } = editor;
      const { tr, doc } = view.state;

      const srcFrom = src.pos;
      const srcTo = src.pos + src.node.nodeSize;

      if (src.parentSectionPos !== null) {
        const target = calcSectionChildDropTarget(e.clientX, e.clientY, src.parentSectionPos);
        if (!target) {
          cleanup();
          return;
        }
        const targetSectionNode = doc.nodeAt(target.sectionPos);
        if (!targetSectionNode || targetSectionNode.type.name !== 'section') {
          cleanup();
          return;
        }
        const endPos = target.sectionPos + targetSectionNode.nodeSize - 1;
        const rawInsertAt = target.insertBefore ?? endPos;

        const slice = doc.slice(srcFrom, srcTo);
        tr.delete(srcFrom, srcTo);
        const insertAt = tr.mapping.map(rawInsertAt, -1);
        if (insertAt !== srcFrom) {
          tr.insert(insertAt, slice.content);
          view.dispatch(tr);
        }
      } else {
        const { insertBefore } = calcTopLevelDropTarget(e.clientY);
        if (insertBefore === null) {
          const slice = doc.slice(srcFrom, srcTo);
          tr.delete(srcFrom, srcTo);
          tr.insert(tr.doc.content.size, slice.content);
          view.dispatch(tr);
        } else if (insertBefore !== srcFrom) {
          const slice = doc.slice(srcFrom, srcTo);
          const insertAt = insertBefore > srcFrom ? insertBefore - (srcTo - srcFrom) : insertBefore;
          tr.delete(srcFrom, srcTo);
          tr.insert(insertAt, slice.content);
          view.dispatch(tr);
        }
      }

      cleanup();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasBlockDragPayload(e.dataTransfer)) return;
      // Only clear if we actually left the editor (not just moved to a child)
      if (!editorDom.contains(e.relatedTarget as Node)) {
        setDropIndicator(null);
      }
    };

    editorDom.addEventListener('dragover', onDragOver, true);
    editorDom.addEventListener('drop', onDrop, true);
    editorDom.addEventListener('dragleave', onDragLeave, true);
    return () => {
      editorDom.removeEventListener('dragover', onDragOver, true);
      editorDom.removeEventListener('drop', onDrop, true);
      editorDom.removeEventListener('dragleave', onDragLeave, true);
    };
  }, [editor, getTopLevelBlockAtPos, BLOCK_DRAG_MIME]);

  // Keep handle visible on the currently active block while typing/editing.
  useEffect(() => {
    editor.on('selectionUpdate', syncHoveredFromSelection);
    editor.on('focus', syncHoveredFromSelection);
    return () => {
      editor.off('selectionUpdate', syncHoveredFromSelection);
      editor.off('focus', syncHoveredFromSelection);
    };
  }, [editor, syncHoveredFromSelection]);

  const cleanup = () => {
    isDraggingRef.current = false;
    dragSrcRef.current?.domNode.removeAttribute('data-ae-dragging');
    dragSrcRef.current = null;
    setDropIndicator(null);
    setHovered(null);
  };

  // ── Handle dragStart from the grip button ───────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent) => {
    const current = hoveredRef.current;
    if (!current) return;

    dragSrcRef.current = current;
    isDraggingRef.current = true;

    // Build a tidy ghost image
    const ghost = document.createElement('div');
    ghost.style.cssText = [
      'position:fixed', 'top:-9999px', 'left:-9999px',
      'background:#fff', 'border:1px solid #e2e8f0', 'border-radius:8px',
      'padding:8px 14px', 'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
      'font-size:13px', 'color:#1e293b', 'max-width:300px',
      'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
      "font-family:'Open Sans',system-ui,sans-serif",
    ].join(';');
    const label = current.node.textContent?.slice(0, 60).trim()
      || current.node.type.name.replace(/([A-Z])/g, ' $1').trim();
    ghost.textContent = label || 'Block';
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, 16, 16);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(BLOCK_DRAG_MIME, String(current.pos));
    // Keep plain text empty so native drop never inserts block position text.
    e.dataTransfer.setData('text/plain', '');

    setTimeout(() => {
      current.domNode.setAttribute('data-ae-dragging', 'true');
      ghost.remove();
    }, 0);
  }, [editor]);

  const onDragEnd = useCallback(() => { cleanup(); }, []);

  const onHandleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const current = hoveredRef.current;
    if (!current) return;

    const isTextBlock = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList'].includes(current.node.type.name);
    if (isTextBlock) {
      const from = current.pos + 1;
      const to = current.pos + current.node.nodeSize - 1;
      if (to > from) {
        const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to));
        editor.view.dispatch(tr);
        editor.commands.focus();
      }
      return;
    }

    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  }, [editor]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!hovered) return null;

  const { rect } = hovered;
  const handleTop = rect.top + rect.height / 2 - 14;
  // Move 40px to the left so it clears any block outline/border
  const handleLeft = Math.max(4, rect.left - 40);

  return createPortal(
    <>
      {/* Grip handle */}
      <div
        ref={handleRef}
        className="ae-block-handle"
        style={{ top: handleTop, left: handleLeft }}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onHandleClick}
        onMouseEnter={() => clearTimeout(hideTimerRef.current)}
        onMouseLeave={() => { hideTimerRef.current = setTimeout(() => setHovered(null), 500); }}
        title="Drag to reorder · Click for options"
      >
        <LuGripVertical size={15} />
      </div>

      {/* Animated drop indicator */}
      {dropIndicator && (
        <div
          className="ae-drop-indicator"
          style={{ top: dropIndicator.y, left: dropIndicator.x, width: dropIndicator.width }}
        />
      )}

      {/* Block context menu */}
      {menuOpen && hovered && (
        <BlockContextMenu
          editor={editor}
          node={hovered.node}
          pos={hovered.pos}
          x={menuPos.x}
          y={menuPos.y}
          assets={assets}
          onClose={() => { setMenuOpen(false); setHovered(null); }}
        />
      )}
    </>,
    document.body,
  );
}
