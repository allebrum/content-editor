# Example: Next.js Full-Page Editor

Demonstrates using `@allebrum/page-editor` in a Next.js 14 App Router project.

## What this shows

- `PageEditor` for full-page authoring
- `onSave` handler that renders static HTML server-side
- `PageRenderer` for the public-facing read-only view
- Next.js Server Action for persisting editor JSON + rendered HTML
- AI endpoint route
- Asset upload endpoint

## Setup

```bash
cd examples/nextjs-full-page
npm install
npm run dev
```

## Key files

- `app/edit/[slug]/page.tsx` — editor page (client component)
- `app/pages/[slug]/page.tsx` — public read-only page
- `app/actions/savePage.ts` — Server Action: save JSON + render HTML
- `app/api/editor-ai/route.ts` — AI endpoint
- `app/api/editor-assets/route.ts` — Asset upload endpoint
