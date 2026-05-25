import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VISUALIZATION_TYPES } from '../utils/visualizationTypes';

interface VisualizePickerProps {
  /** Position for the floating picker */
  coords: { top: number; left: number };
  /** Currently active visualization type (for re-type flows) */
  currentType?: string;
  onSelect: (typeValue: string) => void;
  onClose: () => void;
}

export function VisualizePicker({ coords, currentType, onSelect, onClose }: VisualizePickerProps) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay so the mousedown that opened this picker doesn't immediately close it
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const filtered = query.trim()
    ? VISUALIZATION_TYPES.filter(t =>
        t.label.toLowerCase().includes(query.toLowerCase()),
      )
    : VISUALIZATION_TYPES;

  // Clamp to viewport
  const left = Math.min(coords.left, window.innerWidth - 296);
  const top = Math.min(coords.top, window.innerHeight - 430);

  return createPortal(
    <div
      ref={ref}
      className="ae-viz-picker"
      style={{ position: 'fixed', top, left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="ae-viz-picker__header">
        <span className="ae-viz-picker__title">✦ Choose visualization</span>
        <button className="ae-viz-picker__close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="ae-viz-picker__search">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search types…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="ae-viz-picker__input"
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
      </div>

      <div className="ae-viz-picker__list">
        {filtered.map(t => (
          <button
            key={t.value}
            className={`ae-viz-picker__item${currentType === t.value ? ' ae-viz-picker__item--active' : ''}`}
            onMouseDown={e => { e.preventDefault(); onSelect(t.value); }}
            title={t.description}
          >
            <span className="ae-viz-picker__emoji">{t.emoji}</span>
            <span className="ae-viz-picker__label">{t.label}</span>
            {currentType === t.value && <span className="ae-viz-picker__check">✓</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="ae-viz-picker__empty">No matches for "{query}"</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
