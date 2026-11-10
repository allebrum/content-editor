# @allebrum/page-editor

Portable React block editor with Hoppa-style UX: slash menu, markdown
shortcuts, headings, lists, checkboxes, quotes, callouts, dividers, gutter
actions (drag / reorder / duplicate / delete / turn into), multi-block
selection, and a keyboard reference.

Package name remains `@allebrum/page-editor`. Version **1.0.0** replaces the
0.1.x TipTap page builder. That is an intentional breaking change. See
[MIGRATION.md](./MIGRATION.md). Nothing is published to npm by this
repository’s default workflow — consume the git checkout or your own registry
publish.

## Ownership and license

This combined work is licensed under the **GNU Affero General Public License
v3.0** (`AGPL-3.0-only`). See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

A substantial part of the editing model and canvas behavior is derived from
the Hoppa notes editor in [`allebrum/company-portal`](https://github.com/allebrum/company-portal)
(AGPL-3.0, commit `dcea05ee655308385581660b1e38ac6213249791`). Those terms
travel with the copied files. Allebrum packaging and new modules here do not
erase upstream attribution or license obligations.

If you ship this editor as part of a network service, AGPL-3.0 requires you
to provide corresponding source to users of that service. Confirm with your
own counsel before distributing.

Version 0.1.x was described as MIT and did not include a LICENSE file. The
license change in 1.0.0 is required because AGPL-derived notes code cannot be
redistributed as MIT.

## What the host must do

The editor does **not** persist documents, call APIs, write `localStorage`,
fetch remote images, or authenticate anyone.

- Store `EditorDocument` yourself (`value` / `onChange`).
- Optional `adapters.upload` / `adapters.mention` / `adapters.embed` receive
  user intent. Those slash items appear **only** when the matching adapter is
  passed. They do not create `todo`, `goal`, `timer`, `link`, or `embed`
  blocks.
- Optional `drafts.ts` helpers take an injected `Storage`. `BlockEditor` never
  calls them.
- Optional `extraCommands` let a host add more slash actions without claiming
  unsupported block types.

## Install (from this repo)

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Peer dependencies: React 18 or 19.

```tsx
import { BlockEditor, parseDocument, type EditorDocument } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

function Notes({ value, onChange }: { value: EditorDocument; onChange: (d: EditorDocument) => void }) {
  return (
    <BlockEditor
      value={value}
      onChange={onChange}
      placeholder="Write, or press /"
      readOnly={false}
      adapters={{
        // omit any you do not implement
        upload: (files, { blockId }) => { /* host upload */ },
      }}
      onParseError={(err) => console.error(err.code, err.message)}
    />
  );
}
```

`parseDocument` / `validateDocument` / `fromBlocks` reject legacy TipTap JSON
and unknown block types rather than dropping data. HTML rendering
(`renderDocumentHtml`, `BlockRenderer`) escapes text and never injects raw
HTML. `sanitizeHref` / `isSafeHref` reject `javascript:`, `data:`, `vbscript:`,
`file:`, and protocol-relative URLs.

Also exported: reducer, markdown/slash/paste helpers, selection helpers,
three-way `mergeBlocks` (for host-controlled live sync), and schema types.
Server entry `@allebrum/page-editor/server` has no React.

## Version 2: media blocks and inline marks (opt-in, 1.1.0+)

Version 1 stays the default. Nothing changes for a host that does not opt in:
`parseDocument()` still reads v1 only, `BlockEditor` still emits v1, and v1
HTML output is byte-for-byte the same.

Opt in with `documentVersion={2}` (or by passing a v2 `value`):

```tsx
import {
  BlockEditor, migrateDocument, parseAnyDocument, renderDocumentHtml,
  type EditorDocumentV2,
} from '@allebrum/page-editor';

<BlockEditor<EditorDocumentV2>
  documentVersion={2}
  value={doc}                       // v1 values are migrated on load
  onChange={setDoc}                 // always receives { version: 2, blocks }
  videoProviders={['vimeo']}        // default; add 'youtube' to allow it
  adapters={{
    uploadImage: async (file, { onProgress, signal }) => {
      // resize / validate / upload; report 0–1 progress
      const res = await myUpload(file, { onProgress, signal });
      return { src: res.url, assetKey: res.key };
    },
  }}
/>;
```

What v2 adds:

- **Inline marks** in any text block, edited WYSIWYG: the canvas shows bold,
  italic, inline code and links as formatted text with no visible markers.
  - Ctrl/⌘+B, I, E (code), K (link), and a format bar whose buttons show
    the marks at the selection. With nothing selected, B/I/E toggle the
    marks for what you type next. Ctrl/⌘+K inside a link removes it.
  - Markdown-style shortcuts convert as you type the closing marker:
    `**bold**`, `__bold__`, `*italic*`, `_italic_`, `` `code` ``,
    `[label](https://…)`. Undo right after brings the markers back.
  - Per-block Undo/Redo (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y and the browser's
    Edit menu), selection kept across formatting, IME-safe (nothing is
    rewritten while composing; toggled marks apply to the composed text).
  - Paste keeps bold, italic, code and safe links from HTML (Google Docs,
    Word, web pages) and drops everything else; plain text pastes literally.
  - Storage is the markdown-like string `**bold**`, `*italic*`, `` `code` ``,
    `[label](https://…)`, with backslash escapes; see MIGRATION.md for the
    canonical form. `richFromContent()` / `serializeRich()` and friends expose
    the same model for hosts.
  Unsafe link targets (`javascript:`, `data:`, `//host`, …) render as plain
  text. External links get `target="_blank" rel="noopener noreferrer nofollow"`.
- **`image` block** `{ id, type: 'image', src, alt, width?, caption?, assetKey? }`.
  `src` must be `http(s)` or a same-origin path. The Image slash item and
  image paste appear only when `adapters.uploadImage` is passed. The canvas
  shows a progress bar, Retry/Remove on failure, and Alt text / Caption /
  Width fields. A pending upload is never emitted to `onChange`.
- **`video` block** `{ id, type: 'video', provider: 'vimeo' | 'youtube', videoId, hash?, title?, caption? }`.
  Embed-only: the document stores ids, never an iframe or URL. Renderers build
  `https://player.vimeo.com/video/{id}?dnt=1[&h=hash]` or
  `https://www.youtube-nocookie.com/embed/{id}` with `sandbox`,
  `referrerpolicy="strict-origin-when-cross-origin"`, `loading="lazy"`, and an
  accessible `title`. `parseVideoUrl()` only accepts vimeo.com,
  player.vimeo.com, youtube.com, youtu.be, and youtube-nocookie.com.

Helpers: `parseAnyDocument` (v1 or v2), `migrateDocument` (v1 → v2, escapes
existing text so it renders identically), `documentFromPlainText` (wrap a
legacy string field), `parseInline` / `renderInlineHtml` / `inlineToPlainText`
(for non-React renderers such as React Native), `parseVideoUrl`,
`videoEmbedUrl`, `videoWatchUrl` (native fallback link), `sanitizeImageSrc`.
`renderDocumentHtml(doc, { imageSrc })` and `<BlockRenderer imageSrc>` let a
host rewrite image URLs (e.g. to an image CDN); the result is re-validated.

## Demo

```bash
npm run demo
```

`examples/demo` imports `@allebrum/page-editor` (aliased to this package’s
source) and keeps the document in React state.

## Honest omissions vs 0.1.x and vs Hoppa

Not ported from the old page builder: TipTap extensions, page sections, hero /
FAQ layouts, AI writing, built-in asset library, YouTube nodes.

Not ported from Hoppa notes: to-do / goal / timer / item-link / embed cards,
mention picker UI, file/QR/camera upload UI, React Query, sockets, auth,
autosave, and space-scoped drafts inside the component.

Inline marks, images, and video embeds exist only in **version 2** documents
(opt-in, see below). Version 1 blocks store plain text, matching Hoppa notes.

## Keyboard and IME

Slash menu: `↑↓` / `Enter` / `Esc`. Markdown at the start of an empty text
line: `# `, `## `, `### `, `- ` / `* `, `1. `, `[] `, `> `, `---`.
Composition events (`isComposing` / keyCode `229`) are ignored so IME input
is not intercepted. Paste is plain text only (or files, if `adapters.upload`
exists). Undo of multi-block delete/cut is an in-editor notice, not the
browser history stack.
