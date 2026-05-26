# @allebrum/page-editor

A Gamma-style block-based page editor for React and Next.js applications. Gives non-technical users a modern, click-anywhere editing experience with slash commands, drag-and-drop blocks, AI writing tools, and JSON-canonical content storage.

## Features

- **Click-anywhere editing** — click any block and start typing
- **Slash command menu** — type `/` to insert blocks, filterable by keyword
- **Floating toolbar** — contextual formatting and AI actions on text selection
- **Block-based layout** — sections, flex rows/columns, hero blocks, callouts, FAQs, and more
- **JSON-canonical** — content stored as structured JSON, not raw HTML
- **Static rendering** — server-safe HTML renderer for Next.js SSG/SSR
- **AI tools** — pluggable AI endpoint for writing assistance, summarization, translation, and graphic generation
- **Permissions** — control which blocks and features each user role can access
- **Translations** — extract segments from JSON, translate, and rehydrate
- **Autosave** — debounced autosave with status callbacks
- **Embedded mode** — lightweight editor for descriptions, bios, and small content fields
- **Asset handling** — hook up your own upload/media-picker endpoints
- **Starter section UX** — empty sections auto-start as H1 with quick template/image actions

## Installation

```bash
npm install @allebrum/page-editor
```

Import the styles:

```ts
import '@allebrum/page-editor/styles.css';
```

## Quick Start

### Embedded field editor

For compact editable areas (event descriptions, bios, card text):

```tsx
import { ContentFieldEditor } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

export function EventDescriptionEditor({ value, onChange }) {
  return (
    <ContentFieldEditor
      value={value}
      onChange={onChange}
      placeholder="Write event details..."
      allowedBlocks={['paragraph', 'heading', 'bulletList', 'orderedList', 'link', 'button', 'image']}
    />
  );
}
```

### Full-page editor

For pages, blog posts, landing pages:

```tsx
import { PageEditor } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

export function PageEditView({ page, onSave }) {
  const [doc, setDoc] = React.useState(page.editor_json);

  return (
    <PageEditor
      value={doc}
      onChange={setDoc}
      onSave={async ({ document, html, plainText, assets }) => {
        await onSave({ document, html, plainText, assets });
      }}
      ai={{
        enabled: true,
        endpoint: '/api/editor-ai',
      }}
      assets={{
        uploadEndpoint: '/api/editor-assets',
        pickerEndpoint: '/api/media-library',
        openMediaPicker: async ({ kind, context, currentUrl }) => {
          // Open your media library/modal and return the selected image.
          // Return null if the user cancels.
          return {
            url: 'https://cdn.example.com/media/hero.jpg',
            alt: 'Selected image',
            assetId: 'asset_123',
          };
        },
        placeholderImageUrl: 'https://placehold.co/1600x900/png?text=Selected+Image',
      }}
      permissions={{
        canEditLayout: true,
        canUseAi: true,
        canUploadAssets: true,
      }}
    />
  );
}
```

### Read-only renderer

For public-facing pages:

```tsx
import { PageRenderer } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

export function PageView({ page }) {
  return (
    <PageRenderer
      document={page.editor_json}
      assetResolver={(asset) => `/uploads/${asset.id}`}
    />
  );
}
```

### Server-side static HTML rendering (Next.js)

```ts
import { renderEditorDocumentToHtml, toPlainText } from '@allebrum/page-editor/server';

// In a Next.js API route or Server Action:
export async function savePage(editorJson: EditorJsonDocument) {
  const html = renderEditorDocumentToHtml(editorJson, { sanitize: true });
  const plainText = toPlainText(editorJson);

  await db.pages.update({
    editor_json: editorJson,
    rendered_html: html,
    plain_text: plainText,
  });
}
```

## API Reference

### `<PageEditor>`

Full-page editor component.

```tsx
<PageEditor
  value={documentJson}              // EditorJsonDocument
  onChange={setDocumentJson}        // (doc: EditorJsonDocument) => void
  onSave={handleSave}               // (result: EditorSaveResult) => Promise<void>
  mode="page"                       // "page" | "embedded"
  theme={{
    brandColor: '#2563eb',
    radius: 'lg',
    fontFamily: 'Inter, system-ui, sans-serif',
  }}
  ai={{
    enabled: true,
    endpoint: '/api/editor-ai',     // Your backend AI endpoint
  }}
  assets={{
    uploadEndpoint: '/api/editor-assets',
    pickerEndpoint: '/api/media-library',
    resolveUrl: (asset) => asset.url,
    openMediaPicker: async ({ kind, context, currentUrl }) => {
      return openYourMediaModal({ kind, context, currentUrl });
    },
    placeholderImageUrl: 'https://placehold.co/1600x900/png?text=Selected+Image',
  }}
  permissions={{
    canEditText: true,
    canEditLayout: true,
    canUploadAssets: true,
    canUseAi: true,
    canEditRawHtml: false,
    allowedBlocks: ['paragraph', 'heading', 'image', 'flexRow'],
    lockedBlockIds: ['hero-block-1'],
  }}
  autosave={{
    enabled: true,
    debounceMs: 1500,
  }}
  onAutosaveStart={() => setStatus('saving')}
  onAutosaveSuccess={() => setStatus('saved')}
  onAutosaveError={(err) => console.error(err)}
  showInspector={true}              // Show right-side block inspector panel
  slashCommands={[
    {
      id: 'speaker-card',
      label: 'Speaker Card',
      group: 'Event Blocks',
      icon: SpeakerIcon,
      insert: ({ editor }) => insertSpeakerCard(editor),
    },
  ]}
/>
```

#### `assets.openMediaPicker` contract

```ts
type MediaPickerRequest = {
  kind: 'image';
  context: 'image-block' | 'section-background' | 'section-backdrop';
  currentUrl?: string;
};

type MediaPickerResult = {
  url: string;
  alt?: string;
  assetId?: string;
  width?: number;
  height?: number;
};
```

Image actions call this hook when available (slash image, section background/backdrop image pickers, and starter-section image action). If omitted, the editor inserts a placeholder image URL (`assets.placeholderImageUrl` or the default placehold URL).

#### `EditorSaveResult`

```ts
type EditorSaveResult = {
  document: EditorJsonDocument;
  html: string;
  plainText: string;
  assets: EditorAsset[];
  schemaVersion: string;
};
```

### `<ContentFieldEditor>`

Compact embedded editor for smaller content areas.

```tsx
<ContentFieldEditor
  value={value}
  onChange={setValue}
  placeholder="Write something..."
  minHeight={120}
  maxHeight={500}
  allowedBlocks={['paragraph', 'heading', 'bulletList']}
  ai={{ enabled: true, endpoint: '/api/editor-ai' }}
  onSave={handleSave}
  autosave={{ enabled: true, debounceMs: 2000 }}
/>
```

### `<PageRenderer>`

Read-only renderer. Produces the same visual output as the editor, without editing controls.

```tsx
<PageRenderer
  document={editorJson}
  assetResolver={(asset) => `/cdn/${asset.id}`}
  locale="fr"
  className="my-page-content"
/>
```

### Server utilities

Import from `@allebrum/page-editor/server` (Node-safe, no React/browser dependencies):

```ts
import {
  renderEditorDocumentToHtml,
  toPlainText,
  toMarkdown,
  sanitizeHtml,
  extractTranslatableSegments,
  applyTranslations,
  migrateDocument,
} from '@allebrum/page-editor/server';
```

#### `renderEditorDocumentToHtml(doc, options?)`

Renders a document to a sanitized HTML string.

```ts
const html = renderEditorDocumentToHtml(editorJson, {
  sanitize: true,
  locale: 'en',
  assetResolver: (asset) => `/uploads/${asset.id}`,
});
```

#### `extractTranslatableSegments(doc)`

Walks the document tree and extracts all translatable text segments with stable path-based IDs.

```ts
const segments = extractTranslatableSegments(editorJson);
// [{ id: 'seg_0', path: '...', sourceText: 'Welcome to our hub', blockType: 'heading' }, ...]
```

#### `applyTranslations(doc, translatedSegments)`

Rehydrates translated segments back into the document structure.

```ts
const translatedDoc = applyTranslations(editorJson, {
  'seg_0': 'Bienvenue dans notre hub',
});
```

#### `migrateDocument(doc, targetVersion?)`

Migrates a document from an older schema version to the current version.

```ts
const migratedDoc = migrateDocument(oldDoc);
```

## AI Integration

The editor never handles AI provider keys directly. All AI calls go through a host-provided backend endpoint.

### Editor-side configuration

```tsx
<PageEditor
  ai={{
    enabled: true,
    endpoint: '/api/editor-ai',
  }}
/>
```

### Backend endpoint contract

Implement `POST /api/editor-ai` in your Next.js app:

```ts
// app/api/editor-ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  // body: AiEditorRequest
  // { action, selection, documentContext, locale, instructions }

  if (body.action === 'improve-writing') {
    const result = await openai.chat.completions.create({ ... });
    return NextResponse.json({
      type: 'replace-selection',
      content: result.choices[0].message.content,
    });
  }

  // Handle other actions...
}
```

#### `AiEditorRequest`

```ts
type AiEditorRequest = {
  action:
    | 'improve-writing'
    | 'summarize'
    | 'expand'
    | 'translate'
    | 'generate-svg-graphic'
    | 'generate-image-prompt'
    | 'generate-section'
    | 'generate-alt-text';
  selection?: { text: string; html: string };
  documentContext?: EditorJsonDocument;
  locale?: string;
  instructions?: string;
};
```

#### `AiEditorResponse`

```ts
type AiEditorResponse = {
  type: 'replace-selection' | 'insert-after' | 'insert-block' | 'open-preview';
  content: EditorJsonFragment | string;
  assets?: EditorAsset[];
  warnings?: string[];
};
```

## Storage

### Recommended database schema

**Pages table:**
```sql
id uuid primary key,
slug text unique not null,
title text not null,
editor_schema_version text not null,
editor_json jsonb not null,
rendered_html text,
plain_text text,
asset_manifest jsonb,
published_at timestamptz,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

**Embedded content fields:**
```sql
id uuid primary key,
owner_type text not null,
owner_id uuid not null,
field_key text not null,
editor_schema_version text not null,
editor_json jsonb not null,
rendered_html text,
plain_text text,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique(owner_type, owner_id, field_key)
```

### Save pattern

```ts
import { renderEditorDocumentToHtml, toPlainText } from '@allebrum/page-editor/server';

async function savePageContent(editorJson: EditorJsonDocument) {
  const html = renderEditorDocumentToHtml(editorJson, { sanitize: true });
  const plainText = toPlainText(editorJson);

  await db.pages.update({
    editor_json: editorJson,               // canonical source of truth
    editor_schema_version: editorJson.schemaVersion ?? '1.0.0',
    rendered_html: html,                   // generated output (can be regenerated)
    plain_text: plainText,                 // for search indexing
    updated_at: new Date().toISOString(),
  });
}
```

## Permissions

```ts
type EditorPermissions = {
  canEditText?: boolean;
  canEditLayout?: boolean;
  canUploadAssets?: boolean;
  canUseAi?: boolean;
  canEditRawHtml?: boolean;
  allowedBlocks?: string[];       // whitelist of block types
  disallowedBlocks?: string[];    // blacklist (use one or the other)
  lockedBlockIds?: string[];      // specific blocks the user cannot edit
};
```

**Examples:**

```ts
// Full access (admin)
{ canEditLayout: true, canUseAi: true, canUploadAssets: true }

// Content editor (no layout changes)
{ canEditText: true, canEditLayout: false, allowedBlocks: ['paragraph', 'heading', 'image', 'bulletList'] }

// Event description field
{ allowedBlocks: ['paragraph', 'heading', 'bulletList', 'orderedList', 'link', 'button'] }

// Locked template (text only)
{ canEditText: true, canEditLayout: false, lockedBlockIds: ['hero-1', 'cta-1'] }
```

## Translations

```ts
import {
  extractTranslatableSegments,
  applyTranslations,
  renderEditorDocumentToHtml,
} from '@allebrum/page-editor/server';

// 1. Extract segments from source document
const segments = extractTranslatableSegments(editorJson);

// 2. Send segments to your translation service
const translated = await myTranslationService.translate(segments, 'fr');

// 3. Build translation map
const translationMap = Object.fromEntries(
  translated.map(s => [s.id, s.translatedText])
);

// 4. Rehydrate translated document
const frDoc = applyTranslations(editorJson, translationMap);

// 5. Render translated HTML
const frHtml = renderEditorDocumentToHtml(frDoc, { sanitize: true, locale: 'fr' });
```

## Custom Slash Commands

```tsx
<PageEditor
  slashCommands={[
    {
      id: 'speaker-card',
      label: 'Speaker Card',
      group: 'Event Blocks',
      icon: UserIcon,
      keywords: ['speaker', 'person', 'profile'],
      insert: ({ editor }) => {
        editor.chain().focus().insertContent({
          type: 'callout',
          attrs: { variant: 'info' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Speaker name' }] }],
        }).run();
      },
    },
  ]}
/>
```

## Available Block Types

| Type | Description |
|------|-------------|
| `paragraph` | Standard paragraph text |
| `heading` | H1, H2, H3 headings |
| `bulletList` | Unordered list |
| `orderedList` | Ordered list |
| `blockquote` | Blockquote |
| `codeBlock` | Code block with monospace |
| `image` | Image with optional caption |
| `button` | CTA button with href |
| `callout` | Info/warning/error callout box |
| `spacer` | Vertical spacer with configurable height |
| `section` | Page section with background and padding options |
| `flexRow` | Flex layout row |
| `flexColumn` | Flex layout column |
| `hero` | Full-width hero section |
| `faq` | FAQ container block |
| `faqItem` | Individual FAQ question/answer |
| `embed` | iFrame/embed block |

## CSS and Theming

The package generates semantic HTML with stable `ae-*` CSS classes. Import the default stylesheet:

```ts
import '@allebrum/page-editor/styles.css';
```

Override CSS variables to match your brand:

```css
:root {
  --ae-brand: #2563eb;
  --ae-brand-hover: #1d4ed8;
  --ae-radius: 0.5rem;
  --ae-font-family: 'Inter', system-ui, sans-serif;
}
```

## Package Exports

```ts
// Full client-side package (React components + utilities)
import { PageEditor, ContentFieldEditor, PageRenderer } from '@allebrum/page-editor';

// Read-only renderer only (smaller bundle)
import { PageRenderer } from '@allebrum/page-editor/renderer';

// Server-safe utilities (no React, no browser APIs)
import { renderEditorDocumentToHtml, toPlainText } from '@allebrum/page-editor/server';

// Styles
import '@allebrum/page-editor/styles.css';
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+B` | Bold |
| `Cmd/Ctrl+I` | Italic |
| `Cmd/Ctrl+K` | Insert link |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+S` | Save |
| `/` | Open slash command menu |
| `Esc` | Close menus |
| `Enter` | New block |
| `Shift+Enter` | Line break |
| `Backspace` | Delete empty block / merge |

## Security

- HTML output is sanitized using DOMPurify (browser) or a regex-based sanitizer (SSR/Node)
- AI provider API keys must never be passed as React props — use the `endpoint` option to point to your own backend
- The host application is responsible for auth, rate limiting, and AI key management
- Untrusted HTML blocks are disallowed by default; enable only with explicit admin permission

## License

MIT
