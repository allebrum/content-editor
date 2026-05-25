import type { EditorJsonDocument, Block, TranslatableSegment } from '../schema/types';

let segmentCounter = 0;

function pathString(parts: (string | number)[]): string {
  return parts.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '');
}

function extractFromBlock(
  block: Block,
  path: (string | number)[],
  segments: TranslatableSegment[],
): void {
  const b = block as {
    type: string;
    text?: string;
    content?: Block[];
    attrs?: Record<string, unknown>;
  };

  if (b.type === 'text' && b.text) {
    const id = `seg_${++segmentCounter}_${b.type}`;
    segments.push({
      id,
      path: pathString(path),
      sourceText: b.text,
      blockType: b.type,
    });
    return;
  }

  // Extract translatable attrs
  if (b.attrs) {
    const translatableAttrKeys = ['label', 'caption', 'alt', 'placeholder'];
    for (const key of translatableAttrKeys) {
      if (b.attrs[key] && typeof b.attrs[key] === 'string') {
        const id = `seg_${++segmentCounter}_${b.type}_${key}`;
        segments.push({
          id,
          path: pathString([...path, 'attrs', key]),
          sourceText: String(b.attrs[key]),
          blockType: b.type,
          context: `${b.type} ${key}`,
        });
      }
    }
  }

  if (b.content) {
    b.content.forEach((child, i) => {
      extractFromBlock(child, [...path, 'content', i], segments);
    });
  }
}

export function extractTranslatableSegments(doc: EditorJsonDocument): TranslatableSegment[] {
  segmentCounter = 0;
  const segments: TranslatableSegment[] = [];
  (doc.content ?? []).forEach((block, i) => {
    extractFromBlock(block, ['content', i], segments);
  });
  return segments;
}

export function applyTranslations(
  doc: EditorJsonDocument,
  translations: Record<string, string>,
): EditorJsonDocument {
  const segments = extractTranslatableSegments(doc);

  // Build a lookup: path → translated text
  const byPath: Record<string, string> = {};
  for (const seg of segments) {
    if (translations[seg.id]) {
      byPath[seg.path] = translations[seg.id];
    }
  }

  function translateBlock(block: Block): Block {
    const b = { ...(block as Record<string, unknown>) } as Record<string, unknown>;

    if (b.type === 'text' && typeof b.text === 'string') {
      // Text nodes are matched by content via segments — rebuild handled by path resolution
      return b as unknown as Block;
    }

    if (b.content && Array.isArray(b.content)) {
      b.content = (b.content as Block[]).map(translateBlock);
    }

    return b as unknown as Block;
  }

  // Simple path-based apply for attr translations
  const docCopy: EditorJsonDocument = JSON.parse(JSON.stringify(doc));

  // Re-extract on copy and apply text substitutions by walking in parallel
  function applyToBlock(block: Block & Record<string, unknown>, path: (string | number)[]): void {
    if (block.type === 'text' && typeof block.text === 'string') {
      const p = pathString(path);
      const match = segments.find((s) => s.path === p && s.sourceText === block.text);
      if (match && translations[match.id]) {
        block.text = translations[match.id];
      }
      return;
    }

    if (block.attrs && typeof block.attrs === 'object') {
      const translatableAttrKeys = ['label', 'caption', 'alt', 'placeholder'];
      for (const key of translatableAttrKeys) {
        const attrPath = pathString([...path, 'attrs', key]);
        const match = segments.find((s) => s.path === attrPath);
        if (match && translations[match.id]) {
          (block.attrs as Record<string, unknown>)[key] = translations[match.id];
        }
      }
    }

    if (block.content && Array.isArray(block.content)) {
      (block.content as (Block & Record<string, unknown>)[]).forEach((child, i) => {
        applyToBlock(child, [...path, 'content', i]);
      });
    }
  }

  (docCopy.content ?? []).forEach((block, i) => {
    applyToBlock(block as Block & Record<string, unknown>, ['content', i]);
  });

  return docCopy;
}


