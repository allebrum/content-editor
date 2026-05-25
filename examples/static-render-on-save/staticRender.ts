/**
 * Example: Static render on save
 *
 * Shows how to use @allebrum/page-editor/server to generate static
 * HTML, plain text, Markdown, and translated output from editor JSON.
 *
 * Safe to run in:
 * - Next.js Server Actions
 * - Next.js API routes
 * - Node scripts
 * - Build pipelines
 * - Static site generators
 */

import {
  renderEditorDocumentToHtml,
  toPlainText,
  toMarkdown,
  extractTranslatableSegments,
  applyTranslations,
} from '@allebrum/page-editor/server';

import type { EditorJsonDocument, EditorAsset } from '@allebrum/page-editor';

// ─── 1. Basic save flow ────────────────────────────────────────────────────

interface SavePageInput {
  editorJson: EditorJsonDocument;
  assets: EditorAsset[];
}

interface SavePageOutput {
  editorJson: EditorJsonDocument;
  renderedHtml: string;
  plainText: string;
  markdown: string;
  assetManifest: EditorAsset[];
  schemaVersion: string;
}

export function buildStaticOutput(input: SavePageInput): SavePageOutput {
  const { editorJson, assets } = input;

  const renderedHtml = renderEditorDocumentToHtml(editorJson, {
    sanitize: true,
    assetResolver: (asset) => asset.url,
  });

  const plainText = toPlainText(editorJson);
  const markdown = toMarkdown(editorJson);

  return {
    editorJson,
    renderedHtml,
    plainText,
    markdown,
    assetManifest: assets,
    schemaVersion: '1.0.0',
  };
}

// ─── 2. Multilingual save flow ────────────────────────────────────────────

interface TranslationMap {
  [segmentId: string]: string;
}

export async function buildTranslatedOutput(
  editorJson: EditorJsonDocument,
  locale: string,
  translateFn: (segments: Array<{ id: string; text: string }>) => Promise<TranslationMap>,
): Promise<{ locale: string; translatedJson: EditorJsonDocument; html: string }> {
  // 1. Extract all translatable text segments from the document
  const segments = extractTranslatableSegments(editorJson);

  // 2. Call your translation service (DeepL, Google Translate, OpenAI, etc.)
  const translations = await translateFn(
    segments.map((s) => ({ id: s.id, text: s.sourceText })),
  );

  // 3. Rehydrate translated text back into the document structure
  const translatedJson = applyTranslations(editorJson, translations);

  // 4. Render translated static HTML
  const html = renderEditorDocumentToHtml(translatedJson, {
    sanitize: true,
    locale,
  });

  return { locale, translatedJson, html };
}

// ─── 3. Standalone usage example ──────────────────────────────────────────

async function example() {
  // Pretend this came from your database
  const editorJson: EditorJsonDocument = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Welcome to Our Resource Hub' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Explore our collection of guides, articles, and tools.',
          },
        ],
      },
    ],
  };

  // Build static output
  const output = buildStaticOutput({ editorJson, assets: [] });
  console.log('HTML:', output.renderedHtml);
  console.log('Plain text:', output.plainText);
  console.log('Markdown:', output.markdown);

  // Build translated output (mock translation function)
  const translated = await buildTranslatedOutput(
    editorJson,
    'fr',
    async (segments) => {
      // Replace with your actual translation API call
      const map: TranslationMap = {};
      for (const seg of segments) {
        map[seg.id] = `[FR] ${seg.text}`;
      }
      return map;
    },
  );

  console.log('French HTML:', translated.html);
}

// Run the example
example().catch(console.error);
