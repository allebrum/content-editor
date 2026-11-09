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
    expect(screen.queryByText(/Click to write/)).not.toBeInTheDocument();
    expect(screen.getByTestId('page-editor-append')).toHaveAccessibleName('Continue writing');
  });

  it('marks content as read-only when readOnly or disabled', () => {
    const { rerender } = render(
      <BlockEditor readOnly value={doc([{ id: 'a', type: 'text', content: 'Locked' }])} />,
    );
    expect(screen.getByTestId('block-a')).toHaveAttribute('contenteditable', 'false');
    expect(screen.queryByTestId('page-editor-append')).not.toBeInTheDocument();
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

  it('shows a placeholder only on the focused empty block', () => {
    render(
      <BlockEditor
        placeholder="Write, or press / for commands..."
        value={doc([
          { id: 'a', type: 'text', content: '' },
          { id: 'b', type: 'text', content: '' },
          { id: 'c', type: 'text', content: 'Hi' },
        ])}
      />,
    );
    expect(screen.getByTestId('block-a')).toHaveAttribute('data-placeholder', '');
    expect(screen.getByTestId('block-b')).toHaveAttribute('data-placeholder', '');
    fireEvent.focus(screen.getByTestId('block-b'));
    expect(screen.getByTestId('block-b')).toHaveAttribute(
      'data-placeholder',
      'Write, or press / for commands...',
    );
    expect(screen.getByTestId('block-a')).toHaveAttribute('data-placeholder', '');
  });

  it('shows a single idle placeholder when the whole document is empty', () => {
    render(
      <BlockEditor
        placeholder="Write, or press / for commands..."
        value={doc([{ id: 'a', type: 'text', content: '' }])}
      />,
    );
    expect(screen.getByTestId('block-a')).toHaveAttribute(
      'data-placeholder',
      'Write, or press / for commands...',
    );
  });

  it('creates a new line when the trailing write area is clicked after content', () => {
    const onChange = vi.fn();
    render(
      <BlockEditor value={doc([{ id: 'a', type: 'text', content: 'Hello there' }])} onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('page-editor-append'));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as EditorDocument;
    expect(last.blocks).toHaveLength(2);
    expect(last.blocks[0]?.content).toBe('Hello there');
    expect(last.blocks[1]?.type).toBe('text');
    expect(last.blocks[1]?.content).toBe('');
  });
});
