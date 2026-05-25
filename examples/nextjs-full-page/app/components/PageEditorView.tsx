'use client';

import React, { useState, useTransition } from 'react';
import { PageEditor } from '@allebrum/page-editor';
import type { EditorJsonDocument, EditorSaveResult } from '@allebrum/page-editor';
import { savePage } from '../../actions/savePage';

interface PageEditorViewProps {
  slug: string;
  initialDocument: EditorJsonDocument | null;
}

export function PageEditorView({ slug, initialDocument }: PageEditorViewProps) {
  const [doc, setDoc] = useState<EditorJsonDocument | null>(initialDocument);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition] = useTransition();

  async function handleSave(result: EditorSaveResult) {
    setSaveStatus('saving');
    try {
      await savePage(slug, result);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Save failed', err);
      setSaveStatus('error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
        }}
      >
        <span style={{ fontWeight: 600 }}>Editing: {slug}</span>
        <span
          style={{
            fontSize: '0.875rem',
            color:
              saveStatus === 'saved'
                ? '#16a34a'
                : saveStatus === 'error'
                  ? '#dc2626'
                  : '#6b7280',
          }}
        >
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved ✓'}
          {saveStatus === 'error' && 'Save failed'}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <PageEditor
          value={doc}
          onChange={(newDoc) => {
            startTransition(() => setDoc(newDoc));
          }}
          onSave={handleSave}
          mode="page"
          ai={{
            enabled: true,
            endpoint: '/api/editor-ai',
          }}
          assets={{
            uploadEndpoint: '/api/editor-assets',
            pickerEndpoint: '/api/media-library',
          }}
          permissions={{
            canEditLayout: true,
            canUseAi: true,
            canUploadAssets: true,
          }}
          autosave={{
            enabled: true,
            debounceMs: 2000,
          }}
          onAutosaveStart={() => setSaveStatus('saving')}
          onAutosaveSuccess={() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          }}
          onAutosaveError={(err) => {
            console.error('Autosave error', err);
            setSaveStatus('error');
          }}
          showInspector
        />
      </div>
    </div>
  );
}
