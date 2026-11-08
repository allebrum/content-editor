import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../components/BlockEditor';
import { DocumentParseError } from '../errors';
import type { EditorDocument } from '../types';

const doc = (blocks: EditorDocument['blocks']): EditorDocument => ({ version: 1, blocks });

describe('BlockEditor', () => {
  it('renders supplied blocks as textboxes and a shortcuts control', () => {
    render(<BlockEditor value={doc([{ id: 'a', type: 'text', content: 'Hello there' }])} />);
    expect(screen.getByTestId('block-a')).toHaveTextContent('Hello there');
    expect(screen.getByTestId('page-editor-help-button')).toBeInTheDocument();
    expect(screen.getByText(/Click to write/)).toBeInTheDocument();
  });

  it('marks content as read-only when readOnly or disabled', () => {
    const { rerender } = render(
      <BlockEditor readOnly value={doc([{ id: 'a', type: 'text', content: 'Locked' }])} />,
    );
    expect(screen.getByTestId('block-a')).toHaveAttribute('contenteditable', 'false');
    expect(screen.queryByText(/Click to write/)).not.toBeInTheDocument();
    rerender(<BlockEditor disabled value={doc([{ id: 'a', type: 'text', content: 'Locked' }])} />);
    expect(screen.getByTestId('block-a')).toHaveAttribute('contenteditable', 'false');
  });

  it('emits onChange after an input event', () => {
    const onChange = vi.fn();
    render(<BlockEditor value={doc([{ id: 'a', type: 'text', content: '' }])} onChange={onChange} />);
    const box = screen.getByTestId('block-a');
    box.textContent = 'typed';
    fireEvent.input(box);
    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls;
    const last = calls[calls.length - 1]?.[0] as EditorDocument;
    expect(last.version).toBe(1);
    expect(last.blocks[0]?.content).toBe('typed');
  });

  it('reports legacy documents through onParseError without converting them', () => {
    const onParseError = vi.fn();
    render(
      <BlockEditor
        value={{ type: 'doc', content: [] } as unknown as EditorDocument}
        onParseError={onParseError}
      />,
    );
    expect(onParseError).toHaveBeenCalled();
    expect(onParseError.mock.calls[0]![0]).toBeInstanceOf(DocumentParseError);
    expect(onParseError.mock.calls[0]![0].code).toBe('legacy_page_editor_document');
  });

  it('omits upload/mention/embed slash items unless adapters are provided', async () => {
    render(<BlockEditor value={doc([{ id: 'a', type: 'text', content: '/' }])} />);
    const box = screen.getByTestId('block-a');
    box.textContent = '/';
    fireEvent.input(box);
    // Menu may or may not appear depending on caret helpers in jsdom; adapters
    // still must not invent product block types in the persisted document.
    const { extraCommandsFromAdapters } = await import('../commands');
    expect(extraCommandsFromAdapters({}).map((c) => c.id)).toEqual([]);
    expect(extraCommandsFromAdapters({ mention: () => undefined, upload: () => undefined, embed: () => undefined }).map((c) => c.id))
      .toEqual(['mention', 'upload', 'embed']);
  });
});
