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

Rich inline marks (bold/italic/links inside a paragraph) are not in this
canvas — blocks store plain text, matching Hoppa notes.

## Keyboard and IME

Slash menu: `↑↓` / `Enter` / `Esc`. Markdown at the start of an empty text
line: `# `, `## `, `### `, `- ` / `* `, `1. `, `[] `, `> `, `---`.
Composition events (`isComposing` / keyCode `229`) are ignored so IME input
is not intercepted. Paste is plain text only (or files, if `adapters.upload`
exists). Undo of multi-block delete/cut is an in-editor notice, not the
browser history stack.
