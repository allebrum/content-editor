import React from 'react';
import type { EditorJsonDocument } from '../schema/types';
import { toHtml } from '../serialization/toHtml';
import { sanitizeHtml } from '../serialization/sanitizeHtml';

export interface PageRendererProps {
  document: EditorJsonDocument;
  className?: string;
  assetResolver?: (assetId: string) => string;
  locale?: string;
}

export function PageRenderer({ document, className, assetResolver: _assetResolver }: PageRendererProps) {
  const html = sanitizeHtml(toHtml(document));
  return (
    <div
      className={`ae-renderer${className ? ' ' + className : ''}`}
      data-ae
      data-ae-render=""
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
