# Example: Static Render on Save

Shows how to use `@allebrum/page-editor/server` to generate static output from editor JSON.

## What this shows

- `renderEditorDocumentToHtml` — render sanitized HTML from editor JSON
- `toPlainText` — extract plain text for search indexing
- `toMarkdown` — export Markdown
- `extractTranslatableSegments` — extract text segments for translation
- `applyTranslations` — rehydrate translated segments into the document

## Usage

```ts
import {
  renderEditorDocumentToHtml,
  toPlainText,
  toMarkdown,
} from '@allebrum/page-editor/server';

const html = renderEditorDocumentToHtml(editorJson, { sanitize: true });
const text = toPlainText(editorJson);
const md = toMarkdown(editorJson);
```

All utilities are Node-safe — no React or browser APIs required.
