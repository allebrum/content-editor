// app/actions/savePage.ts
// Next.js Server Action — saves editor JSON + renders static HTML on the server
'use server';

import { renderEditorDocumentToHtml, toPlainText } from '@allebrum/page-editor/server';
import type { EditorSaveResult } from '@allebrum/page-editor';
import { updatePage } from '../../lib/db';

export async function savePage(slug: string, result: EditorSaveResult) {
  const { document, assets } = result;

  // Re-render HTML server-side for security (never trust client-sent HTML)
  const html = renderEditorDocumentToHtml(document, { sanitize: true });
  const plainText = toPlainText(document);

  await updatePage(slug, {
    editor_json: document,
    editor_schema_version: '1.0.0',
    rendered_html: html,
    plain_text: plainText,
    asset_manifest: assets,
    updated_at: new Date().toISOString(),
  });
}
