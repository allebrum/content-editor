import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BlockEditor, emptyDocument, type EditorDocument } from '@allebrum/page-editor';
import '@allebrum/page-editor/styles.css';

function App() {
  const [doc, setDoc] = useState<EditorDocument>(emptyDocument());
  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontFamily: 'system-ui', fontSize: 22 }}>@allebrum/page-editor demo</h1>
      <p style={{ fontFamily: 'system-ui', color: '#4b5563' }}>
        Local host of the package. Persistence stays in this page&apos;s React state — the editor
        does not talk to a network.
      </p>
      <BlockEditor value={doc} onChange={setDoc} placeholder="Write, or press /" />
      <pre style={{ marginTop: 24, fontSize: 12, background: '#f9fafb', padding: 12, overflow: 'auto' }}>
        {JSON.stringify(doc, null, 2)}
      </pre>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
