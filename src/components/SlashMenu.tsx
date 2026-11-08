/**
 * Derived from https://github.com/allebrum/company-portal
 * source path: apps/web/src/components/space/SlashMenu.tsx
 * upstream commit: dcea05ee655308385581660b1e38ac6213249791
 * Licensed under AGPL-3.0. Product-type icons and Hoppa overlay flags removed.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Pilcrow, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Sparkles, Minus, AtSign, Upload, Link as LinkIcon,
} from 'lucide-react';
import { fuzzyScore } from '../blocks';
import { SLASH_COMMANDS, SLASH_GROUP_LABELS, type CommandDef } from '../commands';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: Pilcrow,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  numbered: ListOrdered,
  checkbox: CheckSquare,
  quote: Quote,
  callout: Sparkles,
  divider: Minus,
  mention: AtSign,
  upload: Upload,
  embed: LinkIcon,
};

export function SlashMenu({
  open,
  query,
  anchorRect,
  commands = SLASH_COMMANDS,
  onPick,
  onClose,
}: {
  open: boolean;
  query: string;
  anchorRect: { x: number; y: number; top: number } | null;
  commands?: readonly CommandDef[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);
  const visible = open && !!anchorRect;

  const filtered = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, s: Math.max(fuzzyScore(query, c.id), fuzzyScore(query, c.label), fuzzyScore(query, c.keywords)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.map((x) => x.c);
  }, [commands, query]);

  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    const el = itemRefs.current[active];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    if (!visible) return;
    document.body.setAttribute('data-page-editor-modal-open', '1');
    return () => document.body.removeAttribute('data-page-editor-modal-open');
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const move = (delta: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (filtered.length === 0) return;
        setActive((i) => (i + delta + filtered.length) % filtered.length);
      };
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) return move(1);
      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) return move(-1);
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const cmd = filtered[active];
        if (cmd) onPick(cmd.id);
        else onClose();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, filtered, active, onPick, onClose]);

  useEffect(() => {
    if (!visible) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [visible, onClose]);

  useLayoutEffect(() => {
    if (!visible || !anchorRect) {
      setPlacement(null);
      return;
    }
    const h = panelRef.current?.offsetHeight ?? 320;
    const w = panelRef.current?.offsetWidth ?? 288;
    const below = anchorRect.y + 6;
    const caretTop = anchorRect.top ?? anchorRect.y - 20;
    const fitsBelow = below + h <= window.innerHeight - 8;
    const top = fitsBelow ? below : Math.max(8, caretTop - h - 6);
    const left = Math.max(8, Math.min(anchorRect.x, window.innerWidth - w - 8));
    setPlacement({ left, top });
  }, [visible, anchorRect, filtered.length]);

  if (!visible || !anchorRect) return null;

  const browsing = query.trim() === '';
  const grouped: { group: CommandDef['group'] | null; items: CommandDef[] }[] = [];
  if (browsing) {
    for (const c of filtered) {
      let g = grouped.find((x) => x.group === c.group);
      if (!g) {
        g = { group: c.group, items: [] };
        grouped.push(g);
      }
      g.items.push(c);
    }
  } else if (filtered.length > 0) {
    grouped.push({ group: null, items: filtered });
  }
  const flat = grouped.flatMap((g) => g.items);
  itemRefs.current = [];

  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Insert block"
      className="pe-slash"
      style={{
        left: placement?.left ?? anchorRect.x,
        top: placement?.top ?? anchorRect.y + 6,
        visibility: placement ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="pe-slash-head">
        <span className="pe-mono">/{query}</span>
        <span>↑↓ · Enter · Esc</span>
      </div>
      <div className="pe-slash-list">
        {flat.length === 0 && (
          <div className="pe-slash-empty" role="option" aria-disabled="true" aria-selected="false">
            No results
          </div>
        )}
        {grouped.map((g) => (
          <div key={g.group ?? 'results'} className="pe-slash-group">
            {g.group && <div className="pe-slash-group-label">{SLASH_GROUP_LABELS[g.group]}</div>}
            {g.items.map((c) => {
              const idx = flat.indexOf(c);
              const isActive = idx === active;
              const Icon = ICONS[c.id] ?? Pilcrow;
              return (
                <button
                  key={c.id}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => onPick(c.id)}
                  className={`pe-slash-item${isActive ? ' is-active' : ''}`}
                >
                  <span className="pe-slash-icon"><Icon className="pe-icon" /></span>
                  <span className="pe-slash-text">
                    <span className="pe-slash-label">{c.label}</span>
                    <span className="pe-slash-hint">{c.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
