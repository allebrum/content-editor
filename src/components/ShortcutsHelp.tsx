/**
 * Derived from https://github.com/allebrum/company-portal
 * source path: apps/web/src/components/space/NotesShortcutsHelp.tsx
 * upstream commit: dcea05ee655308385581660b1e38ac6213249791
 * Licensed under AGPL-3.0.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { buildNotesHelp, isHelpHotkey } from '../help';

const SECTIONS = buildNotesHelp();

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    restoreFocusRef.current = active && active !== document.body ? active : btnRef.current;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    const back = restoreFocusRef.current ?? btnRef.current;
    restoreFocusRef.current = null;
    requestAnimationFrame(() => back?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || !isHelpHotkey(e)) return;
      if (e.key === '?' && isTypingTarget(e.target)) return;
      if (document.body.hasAttribute('data-page-editor-modal-open') && !open) return;
      e.preventDefault();
      if (open) close();
      else show();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-page-editor-modal-open', '1');
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => document.body.removeAttribute('data-page-editor-modal-open');
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : show())}
        aria-label="Editor shortcuts and commands"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Shortcuts & commands (?)"
        data-testid="page-editor-help-button"
        className="pe-help-btn"
      >
        <HelpCircle className="pe-icon" />
      </button>
      {open && (
        <div className="pe-help-backdrop" onMouseDown={close}>
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Shortcuts and commands"
            tabIndex={-1}
            className="pe-help-panel"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="pe-help-bar">
              <strong>Shortcuts & commands</strong>
              <button type="button" className="pe-help-close" aria-label="Close shortcuts" onClick={close}>
                <X className="pe-icon" />
              </button>
            </div>
            <div className="pe-help-body">
              {SECTIONS.map((s) => (
                <section key={s.id} className="pe-help-section">
                  <h3>{s.title}</h3>
                  {s.note && <p className="pe-help-note">{s.note}</p>}
                  <ul>
                    {s.rows.map((r, i) => (
                      <li key={i}>
                        <span className="pe-keys">{r.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}</span>
                        <span>{r.label}{r.hint ? ` — ${r.hint}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
