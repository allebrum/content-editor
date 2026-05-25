import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { VISUALIZATION_TYPES } from './BubbleToolbar';
import type { AiConfig } from '../schema/types';

export function SvgGraphicNodeView({ node, selected, deleteNode, updateAttributes, editor }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  const [changingType, setChangingType] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [typeFilter, setTypeFilter] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const svgContent = node.attrs.svgContent as string;
  const prompt = node.attrs.prompt as string;
  const currentType = node.attrs.visualizationType as string;

  const aiConfig = (editor.storage?.svgGraphic?.aiConfig ?? null) as AiConfig | null;

  const openTypePicker = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPickerPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 236) });
    setChangingType(v => !v);
    setTypeFilter('');
  };

  const handleChangeType = async (vizType: string) => {
    setChangingType(false);
    setTypeFilter('');
    if (!aiConfig?.endpoint) return;
    setRegenerating(true);
    try {
      const res = await fetch(aiConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(aiConfig.headers ?? {}) },
        body: JSON.stringify({
          action: 'generate-svg-graphic',
          selection: { text: prompt, from: 0, to: 0 },
          instructions: vizType,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.type === 'insert-block') {
        const newSvg = typeof data.content === 'string'
          ? data.content
          : (data.content?.attrs?.svgContent as string | undefined);
        if (newSvg) {
          updateAttributes({ svgContent: newSvg, visualizationType: vizType });
        }
      }
    } finally {
      setRegenerating(false);
    }
  };

  const filteredTypes = VISUALIZATION_TYPES.filter(t =>
    !typeFilter || t.label.toLowerCase().includes(typeFilter.toLowerCase()),
  );

  return (
    <NodeViewWrapper className="ae-svg-graphic" data-drag-handle>
      <div
        className={`ae-svg-graphic__wrapper${selected ? ' ae-svg-graphic--selected' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); }}
      >
        {regenerating ? (
          <div className="ae-svg-graphic__loading">
            <span className="ae-tb-spinner" />
            <span>Regenerating…</span>
          </div>
        ) : svgContent ? (
          <div
            className="ae-svg-graphic__content"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="ae-svg-graphic__empty">
            <span>✦ SVG graphic</span>
          </div>
        )}

        {(hovered || selected) && !regenerating && (
          <div className="ae-svg-graphic__toolbar">
            {prompt && (
              <span className="ae-svg-graphic__prompt" title={prompt}>
                {prompt.slice(0, 40)}{prompt.length > 40 ? '…' : ''}
              </span>
            )}
            {aiConfig?.enabled && (
              <button
                className="ae-svg-graphic__tb-btn"
                onMouseDown={openTypePicker}
                title="Change visualization type"
              >
                ⇄ Change type
              </button>
            )}
            <button
              className="ae-svg-graphic__tb-btn ae-svg-graphic__tb-btn--danger"
              onMouseDown={e => { e.preventDefault(); deleteNode(); }}
              title="Remove graphic"
            >
              ✕
            </button>
          </div>
        )}

        {/* Type picker panel */}
        {changingType && createPortal(
          <div
            className="ae-svg-type-picker"
            style={{ top: pickerPos.top, left: pickerPos.left }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="ae-svg-type-picker__header">
              <span>Choose visualization type</span>
              <button
                className="ae-svg-graphic__tb-btn"
                onMouseDown={e => { e.preventDefault(); setChangingType(false); }}
              >✕</button>
            </div>
            <div className="ae-tb-viz-search-wrap" style={{ padding: '6px 8px' }}>
              <input
                className="ae-tb-viz-search"
                type="text"
                placeholder="Search types…"
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                onMouseDown={e => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="ae-svg-type-picker__list">
              {filteredTypes.map(vt => (
                <button
                  key={vt.value}
                  className={`ae-tb-menu-item${vt.value === currentType ? ' ae-tb-menu-item--active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleChangeType(vt.value); }}
                  title={vt.description}
                >
                  <span className="ae-tb-ai-icon" style={{ fontSize: 16 }}>{vt.icon}</span>
                  {vt.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </NodeViewWrapper>
  );
}
