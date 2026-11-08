# Migration from @allebrum/page-editor 0.1.x

This is a **breaking** 1.0.0 release. The TipTap 2 page-builder (`PageEditor`,
`ContentFieldEditor`, page sections, AI helpers, asset pickers, YouTube embeds)
is gone. The package now exports a Hoppa-style block canvas.

## No automatic conversion

Documents persisted by 0.1.x look like TipTap / ProseMirror JSON:

```json
{ "type": "doc", "content": [ { "type": "paragraph", "content": [...] } ] }
```

`parseDocument()` **rejects** that shape with

```
DocumentParseError { code: "legacy_page_editor_document" }
```

There is **no** silent rewriter. A mechanical mapping would drop marks,
custom nodes, and layout that this editor does not have, which is data loss.

If you still have 0.1.x documents, keep a copy and write an explicit,
reviewed converter in the host application. A safe starter (plain paragraphs
and headings only — extend only after inspecting real documents):

```ts
// Host-owned, not shipped: inspect every node type you actually stored
// before using this. Unknown nodes should fail closed, not be dropped.
```

This package will not guess. Prefer exporting plaintext from the old editor
and pasting it (plain-text paste creates one block per line).

## New document shape

```ts
import { parseDocument, type EditorDocument } from '@allebrum/page-editor';

const value: EditorDocument = {
  version: 1,
  blocks: [
    { id: 'a1', type: 'h1', content: 'Title' },
    { id: 'a2', type: 'text', content: 'Hello' },
  ],
};

parseDocument(value);
```

Supported block types: `text`, `h1`, `h2`, `h3`, `bullet`, `numbered`,
`checkbox`, `quote`, `callout`, `divider`.

Hoppa `SpaceBlock[]` arrays (no `version`) and Hoppa product types
(`todo`, `goal`, `timer`, `link`, `embed`) are **rejected**. Use
`fromBlocks()` only after you have stripped or rewritten unsupported types
yourself. The editor will not silently omit them.

Limits: 2000 blocks, 8000 characters per block, 80-character ids.

## API rename

| 0.1.x | 1.0.0 |
| --- | --- |
| `PageEditor` / `ContentFieldEditor` | `BlockEditor` |
| TipTap JSON `onUpdate` | `value` / `onChange(EditorDocument)` |
| built-in uploads / AI | host `adapters` (`upload`, `mention`, `embed`) |

React peer range is `^18 || ^19`. Import styles:

```ts
import '@allebrum/page-editor/styles.css';
```
