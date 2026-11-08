/**
 * Minimal anchored popover. Replaces Hoppa's @/components/ui/Popover so the
 * package has no UI-kit dependency.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Popover({
  open,
  onClose,
  anchorRef,
  width = 208,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  width?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const h = panelRef.current?.offsetHeight ?? 240;
    const top = anchor.bottom + 4 + h > window.innerHeight - 8
      ? Math.max(8, anchor.top - h - 4)
      : anchor.bottom + 4;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    setPos({ left, top });
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      className="pe-popover"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
