import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { SlashCommandItem } from '../schema/types';

interface SlashCommandMenuProps {
  editor: Editor | null;
}

interface SuggestionProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect?: (() => DOMRect | null) | null;
}

export interface SlashCommandMenuHandle {
  open: (props: SuggestionProps) => void;
  close: () => void;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuHandle, SlashCommandMenuProps>(
  function SlashCommandMenu({ editor: _editor }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState<SlashCommandItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const commandRef = useRef<((item: SlashCommandItem) => void) | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      open: (props: SuggestionProps) => {
        setItems(props.items ?? []);
        setSelectedIndex(0);
        commandRef.current = props.command;

        if (props.clientRect) {
          const rect = props.clientRect();
          if (rect) {
            // Use viewport-relative coordinates (fixed positioning — no scroll offset needed)
            const MENU_WIDTH = 320;
            const MENU_HEIGHT = 360;
            const GAP = 6;

            let top = rect.bottom + GAP;
            let left = rect.left;

            // Flip up if menu would overflow the bottom of the viewport
            if (top + MENU_HEIGHT > window.innerHeight) {
              top = rect.top - MENU_HEIGHT - GAP;
            }

            // Clamp left so menu doesn't overflow right edge
            if (left + MENU_WIDTH > window.innerWidth) {
              left = window.innerWidth - MENU_WIDTH - 8;
            }

            // Never go off-screen left
            if (left < 8) left = 8;

            setPosition({ top, left });
          }
        }
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }));

    const select = useCallback(
      (item: SlashCommandItem) => {
        commandRef.current?.(item);
        setIsOpen(false);
      },
      [],
    );

    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (items[selectedIndex]) select(items[selectedIndex]);
        } else if (e.key === 'Escape') {
          setIsOpen(false);
        }
      };
      window.addEventListener('keydown', handler, true);
      return () => window.removeEventListener('keydown', handler, true);
    }, [isOpen, items, selectedIndex, select]);

    // Group items
    const grouped = items.reduce<Record<string, SlashCommandItem[]>>((acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    }, {});

    if (!isOpen || items.length === 0) return null;

    let flatIndex = 0;

    const menu = (
      <div
        ref={containerRef}
        className="ae-slash-menu"
        role="listbox"
        aria-label="Insert block"
        style={{ position: 'fixed', top: position.top, left: position.left }}
      >
        {Object.entries(grouped).map(([group, groupItems]) => (
          <div key={group} className="ae-slash-menu__group">
            <div className="ae-slash-menu__group-label" role="presentation">{group}</div>
            {groupItems.map((item) => {
              const idx = flatIndex++;
              return (
                <button
                  key={item.id}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`ae-slash-menu__item${idx === selectedIndex ? ' ae-slash-menu__item--active' : ''}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(item);
                  }}
                >
                  {item.icon && (
                    <span className="ae-slash-menu__icon" aria-hidden="true">
                      <item.icon />
                    </span>
                  )}
                  <span className="ae-slash-menu__label">{item.label}</span>
                  {item.description && (
                    <span className="ae-slash-menu__desc">{item.description}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );

    return createPortal(menu, document.body);
  },
);

