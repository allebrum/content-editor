/**
 * Compile- and run-time guard for existing 1.0 hosts (e.g. Cornerstone's
 * RichTextEditor / note-doc). `npm run typecheck` fails if 1.1 narrows or
 * widens a type these patterns rely on.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BlockEditor, BlockRenderer, DOCUMENT_VERSION, parseDocument, type Block, type EditorDocument,
} from '../index';
import { renderDocumentHtml } from '../server';

type NoteDoc = EditorDocument;
const EMPTY: NoteDoc = { version: 1, blocks: [{ id: 'empty', type: 'text', content: '' }] };

function Host({ doc, onChange }: { doc: NoteDoc; onChange: (d: NoteDoc) => void }) {
  return (
    <>
      <BlockEditor value={doc} onChange={onChange as (next: EditorDocument) => void} ariaLabel="Notes" />
      <BlockEditor value={doc} onChange={(next) => onChange(next)} />
      <BlockRenderer value={doc} />
    </>
  );
}

describe('1.0 host compatibility', () => {
  it('keeps v1 types and behavior', () => {
    const parsed: EditorDocument = parseDocument(EMPTY);
    const blocks: Block[] = parsed.blocks;
    const v: 1 = parsed.version;
    expect(v).toBe(DOCUMENT_VERSION);
    expect(blocks).toHaveLength(1);
    expect(renderDocumentHtml(EMPTY)).toBe('<p></p>');
    render(<Host doc={EMPTY} onChange={() => undefined} />);
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});
