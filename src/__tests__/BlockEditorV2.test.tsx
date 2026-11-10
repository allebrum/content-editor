import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../components/BlockEditor';
import type { AnyEditorDocument, EditorDocument, EditorDocumentV2, ImageUploadContext } from '../types';

const v1 = (content: string): EditorDocument => ({ version: 1, blocks: [{ id: 'a', type: 'text', content }] });
const lastDoc = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1]?.[0] as AnyEditorDocument;

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('BlockEditor v2', () => {
  it('keeps emitting v1 by default and without format controls', () => {
    const onChange = vi.fn();
    render(<BlockEditor value={v1('')} onChange={onChange} />);
    const box = screen.getByTestId('block-a');
    box.textContent = '**x**';
    fireEvent.input(box);
    expect(lastDoc(onChange)).toEqual({ version: 1, blocks: [{ id: 'a', type: 'text', content: '**x**' }] });
    expect(screen.queryByRole('toolbar', { name: 'Text formatting' })).toBeNull();
  });

  it('migrates a v1 value when documentVersion is 2 and emits v2', () => {
    const onChange = vi.fn();
    render(<BlockEditor<AnyEditorDocument> documentVersion={2} value={v1('2 * 3')} onChange={onChange} />);
    // WYSIWYG: the migrated escape is not shown; the star is literal text.
    expect(screen.getByTestId('block-a')).toHaveTextContent('2 * 3');
    const box = screen.getByTestId('block-a');
    box.innerHTML = 'now <strong>bold</strong>';
    fireEvent.input(box);
    expect(lastDoc(onChange)).toEqual({ version: 2, blocks: [{ id: 'a', type: 'text', content: 'now **bold**' }] });
    expect(screen.getByRole('toolbar', { name: 'Text formatting' })).toBeInTheDocument();
  });

  it('applies Ctrl+B to the selection', () => {
    const onChange = vi.fn();
    render(<BlockEditor<EditorDocumentV2> value={{ version: 2, blocks: [{ id: 'a', type: 'text', content: 'hello world' }] }} onChange={onChange} />);
    const box = screen.getByTestId('block-a');
    const text = box.firstChild!;
    const range = document.createRange();
    range.setStart(text, 6);
    range.setEnd(text, 11);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.keyDown(box, { key: 'b', ctrlKey: true });
    return vi.waitFor(() => {
      expect((lastDoc(onChange).blocks[0] as { content: string }).content).toBe('hello **world**');
    });
  });

  it('uploads pasted images through uploadImage with progress, then edits alt text', async () => {
    const onChange = vi.fn();
    const pending = deferred<{ src: string; assetKey: string }>();
    let ctx: ImageUploadContext | null = null;
    const uploadImage = vi.fn((_file: File, c: ImageUploadContext) => { ctx = c; return pending.promise; });
    render(
      <BlockEditor<EditorDocumentV2>
        value={{ version: 2, blocks: [{ id: 'a', type: 'text', content: '' }] }}
        onChange={onChange}
        adapters={{ uploadImage }}
      />,
    );
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'calm.png', { type: 'image/png' });
    fireEvent.paste(screen.getByTestId('block-a'), { clipboardData: { files: [file], getData: () => '' } });
    expect(uploadImage).toHaveBeenCalledTimes(1);
    act(() => ctx!.onProgress(0.4));
    const bar = screen.getByRole('progressbar', { name: 'Uploading calm.png' });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    // The pending image never reaches the host document.
    expect(onChange.mock.calls.every(([d]) => (d as EditorDocumentV2).blocks.every((b) => b.type !== 'image'))).toBe(true);

    await act(async () => { pending.resolve({ src: '/uploads/abc', assetKey: 'abc' }); });
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(lastDoc(onChange).blocks).toEqual([{ id: 'a', type: 'image', alt: '', src: '/uploads/abc', assetKey: 'abc' }]);

    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'A calm room' } });
    expect((lastDoc(onChange).blocks[0] as { alt: string }).alt).toBe('A calm room');
    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '480' } });
    expect((lastDoc(onChange).blocks[0] as { width: number }).width).toBe(480);
  });

  it('shows upload errors with retry and remove', async () => {
    const uploadImage = vi.fn().mockRejectedValueOnce(new Error('Too large')).mockResolvedValueOnce({ src: '/uploads/ok' });
    const onChange = vi.fn();
    render(
      <BlockEditor<EditorDocumentV2>
        value={{ version: 2, blocks: [{ id: 'a', type: 'text', content: '' }] }}
        onChange={onChange}
        adapters={{ uploadImage }}
      />,
    );
    const file = new File([new Uint8Array([1])], 'big.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.paste(screen.getByTestId('block-a'), { clipboardData: { files: [file], getData: () => '' } });
    });
    expect(screen.getByText('Too large')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect((lastDoc(onChange).blocks[0] as { src: string }).src).toBe('/uploads/ok');
  });

  it('renders stored image and video blocks in the canvas', () => {
    render(
      <BlockEditor<EditorDocumentV2>
        value={{
          version: 2,
          blocks: [
            { id: 'i', type: 'image', src: 'https://cdn.example/a.png', alt: 'Alt' },
            { id: 'v', type: 'video', provider: 'vimeo', videoId: '123' },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('image-i').querySelector('img')).toHaveAttribute('alt', 'Alt');
    expect(screen.getByTestId('video-v').querySelector('iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/123?dnt=1');
  });

  it('inserts a Vimeo embed from the slash menu and rejects other hosts', async () => {
    const onChange = vi.fn();
    render(
      <BlockEditor<EditorDocumentV2>
        value={{ version: 2, blocks: [{ id: 'a', type: 'text', content: '' }] }}
        onChange={onChange}
      />,
    );
    const box = screen.getByTestId('block-a');
    box.textContent = '/video';
    fireEvent.input(box);
    fireEvent.click(await screen.findByText('Video'));
    const input = await screen.findByLabelText('Vimeo link');
    fireEvent.change(input, { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Embed' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Paste a Vimeo video link.');
    fireEvent.change(input, { target: { value: 'https://vimeo.com/76979871' } });
    fireEvent.click(screen.getByRole('button', { name: 'Embed' }));
    expect(lastDoc(onChange).blocks).toEqual([{ id: 'a', type: 'video', provider: 'vimeo', videoId: '76979871' }]);
  });

  it('embeds a video with Enter inside a host <form> without submitting it', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <BlockEditor<EditorDocumentV2>
          value={{ version: 2, blocks: [{ id: 'a', type: 'text', content: '' }] }}
          onChange={onChange}
        />
      </form>,
    );
    const box = screen.getByTestId('block-a');
    box.textContent = '/video';
    fireEvent.input(box);
    fireEvent.click(await screen.findByText('Video'));
    expect(container.querySelectorAll('form')).toHaveLength(1);
    const input = await screen.findByLabelText('Vimeo link');
    fireEvent.change(input, { target: { value: 'https://vimeo.com/76979871' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(lastDoc(onChange).blocks).toEqual([{ id: 'a', type: 'video', provider: 'vimeo', videoId: '76979871' }]);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
