# Migration notes

## 1.0.x → 1.1.0 (additive, no breaking changes)

1.1.0 adds **document version 2** (image and video blocks, inline marks).
It is opt-in. If you do nothing:

- `DOCUMENT_VERSION` is still `1`; `EditorDocument` and `Block` types are unchanged.
- `parseDocument()` still accepts only v1 and returns the same objects. For a
  v2 document it throws `DocumentParseError { code: "unsupported_document" }`
  with a message pointing at `parseAnyDocument()`.
- `BlockEditor` emits v1 unless `documentVersion={2}` is set or `value` is v2.
  `BlockEditorProps` gained an optional type parameter that defaults to
  `EditorDocument`, so existing `onChange` handlers type-check unchanged.
- `renderDocumentHtml(v1)` and `<BlockRenderer value={v1}>` output is unchanged.
  `renderDocumentHtml` gained an optional second `options` argument.
- Copy-as-HTML/plain text (`blocksToHtml`, `blocksToPlainText`) only differs
  for media blocks, which v1 documents cannot contain.

### Opting in

1. Read stored JSON with `parseAnyDocument(value)` (accepts v1 and v2).
2. Upgrade with `migrateDocument(value)`. It keeps block ids and
   backslash-escapes the marker characters (backslash, `*`, `_`, backtick,
   `[`, `]`) in existing text, so v1 content renders identically as v2.
   It is idempotent for v2 input. There is no automatic downgrade.
3. Pass `documentVersion={2}` to `BlockEditor`; `onChange` then always
   receives `{ version: 2, blocks }`.
4. Update server-side validation that pins `version === 1` (for example a
   Zod schema or a `parseDocument()` call) to `parseAnyDocument()`.
5. Provide `adapters.uploadImage` to enable image upload; pass
   `videoProviders={['vimeo', 'youtube']}` to allow YouTube (Vimeo only by default).

### WYSIWYG editing of inline marks (v2 only)

The v2 canvas edits formatted text directly; stored markers are never shown.
The **stored format is unchanged**: `content` is still the markdown-like
string, so documents written before and after this change read the same.
Notes for hosts:

- The editor writes *canonical* content: `_x_` is saved as `*x*`,
  whitespace at the edge of bold/italic moves outside the mark, and a
  U+2060 WORD JOINER separates `*` markers that would otherwise touch
  (`*a*\u2060**b**`). Every parser in this package ignores U+2060, and it is
  never part of the visible text. Content is only rewritten when a block is
  edited; `canonicalContent()` normalizes on demand.
- Text typed or pasted as plain text is literal: `2 * 3` is stored as
  `2 \* 3`. Typed shortcuts (`**text**`, `*text*`, `_text_`, `__text__`,
  `` `text` ``, `[text](url)`) convert when the closing marker is typed.
- Pasted HTML keeps only bold, italic, code and safe links.
- Caret offsets that the editor passes around (focus positions, slash
  `tokenStart`, `ExtraSlashCommand.run({ caret })`) are visible-text
  offsets in v2. `slashPickPlan()` gained an optional `removeToken` argument.
- `blocksToPlainText()` and `blocksToHtml()` gained an optional third
  argument `{ inlineMarks: true }` that copies formatted text instead of the
  stored markers. Without it, output is unchanged.
- v1 editing is untouched: v1 blocks are still plain text nodes, markers
  are literal, and no undo stack or auto-formatting is added.

v2 limits: image `alt` ≤ 500 chars, `caption` ≤ 1000, `width` 40–4000 px,
`src` ≤ 2048 chars and `http(s)` or same-origin path only; Vimeo ids are
digits, hashes 6–32 hex chars; YouTube ids are 11 `[A-Za-z0-9_-]` chars.

## 0.1.x → 1.0.0


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
