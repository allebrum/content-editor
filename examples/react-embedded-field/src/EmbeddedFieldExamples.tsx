import React, { useState } from 'react';
import { ContentFieldEditor } from '@allebrum/page-editor';
import type { EditorJsonDocument } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

/**
 * Example: Event description editor
 *
 * Only allows paragraphs, headings, lists, links, and buttons.
 * AI writing tools enabled. Images not allowed.
 */
export function EventDescriptionEditor({
  initialValue,
  onSave,
}: {
  initialValue: EditorJsonDocument | null;
  onSave: (doc: EditorJsonDocument) => Promise<void>;
}) {
  const [status, setStatus] = useState<string>('');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Event Description</label>
        {status && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{status}</span>}
      </div>

      <ContentFieldEditor
        value={initialValue}
        placeholder="Describe the event..."
        minHeight={160}
        maxHeight={500}
        allowedBlocks={[
          'paragraph',
          'heading',
          'bulletList',
          'orderedList',
          'link',
          'button',
        ]}
        ai={{
          enabled: true,
          endpoint: '/api/editor-ai',
        }}
        autosave={{
          enabled: true,
          debounceMs: 1500,
        }}
        onAutosaveStart={() => setStatus('Saving…')}
        onAutosaveSuccess={() => {
          setStatus('Saved ✓');
          setTimeout(() => setStatus(''), 2000);
        }}
        onAutosaveError={() => setStatus('Save failed')}
        onSave={async ({ document }) => {
          setStatus('Saving…');
          await onSave(document);
          setStatus('Saved ✓');
          setTimeout(() => setStatus(''), 2000);
        }}
      />
    </div>
  );
}

/**
 * Example: Profile bio editor (very restricted)
 *
 * Plain text only — no headings, no lists, no media.
 */
export function ProfileBioEditor({
  initialValue,
  onChange,
}: {
  initialValue: EditorJsonDocument | null;
  onChange: (doc: EditorJsonDocument) => void;
}) {
  return (
    <ContentFieldEditor
      value={initialValue}
      onChange={onChange}
      placeholder="Write a short bio..."
      minHeight={80}
      maxHeight={240}
      allowedBlocks={['paragraph']}
    />
  );
}

/**
 * Example: Rich announcement editor (full inline formatting + media)
 *
 * Allows most inline content blocks but no complex layout.
 */
export function AnnouncementEditor({
  initialValue,
  onChange,
}: {
  initialValue: EditorJsonDocument | null;
  onChange: (doc: EditorJsonDocument) => void;
}) {
  return (
    <ContentFieldEditor
      value={initialValue}
      onChange={onChange}
      placeholder="Write the announcement..."
      minHeight={200}
      maxHeight={600}
      allowedBlocks={[
        'paragraph',
        'heading',
        'bulletList',
        'orderedList',
        'image',
        'button',
        'callout',
        'blockquote',
      ]}
      ai={{
        enabled: true,
        endpoint: '/api/editor-ai',
      }}
    />
  );
}
