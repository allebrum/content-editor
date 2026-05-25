import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditorJsonDocument,
  EditorPermissions,
  AiConfig,
  AssetConfig,
  EditorTheme,
  SlashCommandItem,
  EditorSaveResult,
} from '../schema/types';
import type { AutosaveConfig, AutosaveCallbacks } from '../storage/types';
import { CURRENT_SCHEMA_VERSION } from '../storage/types';
import { EditorRoot, type EditorRootHandle } from './EditorRoot';
import { toHtml } from '../serialization/toHtml';
import { toPlainText } from '../serialization/toPlainText';
import { sanitizeHtml } from '../serialization/sanitizeHtml';
import { buildAssetManifest } from '../utils/assets';
import { debounce } from '../utils/debounce';

export interface PageEditorProps extends AutosaveCallbacks {
  /** Current document value (controlled) */
  value?: EditorJsonDocument | null;
  /** Editor mode */
  mode?: 'page' | 'embedded';
  /** Called on every content change */
  onChange?: (doc: EditorJsonDocument) => void;
  /** Called on explicit save (Cmd+S or save button) */
  onSave?: (result: EditorSaveResult) => Promise<void> | void;
  /** Placeholder text */
  placeholder?: string;
  /** AI configuration */
  ai?: AiConfig;
  /** Asset upload/picker configuration */
  assets?: AssetConfig;
  /** User permissions */
  permissions?: EditorPermissions;
  /** Visual theme overrides */
  theme?: EditorTheme;
  /** Additional slash commands */
  slashCommands?: SlashCommandItem[];
  /** Autosave configuration */
  autosave?: AutosaveConfig;
  /** Show right-side inspector panel */
  showInspector?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Autofocus the editor on mount */
  autofocus?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

export function PageEditor({
  value,
  mode = 'page',
  onChange,
  onSave,
  placeholder,
  ai,
  assets,
  permissions = {},
  theme,
  slashCommands,
  autosave,
  showInspector = false,
  className,
  autofocus = false,
  readOnly = false,
  onAutosaveStart,
  onAutosaveSuccess,
  onAutosaveError,
}: PageEditorProps) {
  const editorRef = useRef<EditorRootHandle>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const docRef = useRef<EditorJsonDocument | null>(value ?? null);

  // Keep docRef updated without triggering re-renders
  const handleChange = useCallback(
    (doc: EditorJsonDocument) => {
      docRef.current = doc;
      onChange?.(doc);
    },
    [onChange],
  );

  const buildSaveResult = useCallback((doc: EditorJsonDocument): EditorSaveResult => {
    const html = sanitizeHtml(toHtml(doc));
    const plainText = toPlainText(doc);
    const assets = buildAssetManifest(doc);
    return { document: doc, html, plainText, assets, schemaVersion: CURRENT_SCHEMA_VERSION };
  }, []);

  const save = useCallback(async () => {
    const doc = docRef.current ?? editorRef.current?.getJson();
    if (!doc || !onSave) return;
    setIsSaving(true);
    try {
      const result = buildSaveResult(doc);
      await onSave(result);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }, [onSave, buildSaveResult]);

  // Keep latest autosave-related callbacks in refs so the debounced fn never goes stale
  const autosaveRef = useRef(autosave);
  const onSaveRef = useRef(onSave);
  const buildSaveResultRef = useRef(buildSaveResult);
  const onAutosaveStartRef = useRef(onAutosaveStart);
  const onAutosaveSuccessRef = useRef(onAutosaveSuccess);
  const onAutosaveErrorRef = useRef(onAutosaveError);
  useEffect(() => { autosaveRef.current = autosave; }, [autosave]);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  useEffect(() => { buildSaveResultRef.current = buildSaveResult; }, [buildSaveResult]);
  useEffect(() => { onAutosaveStartRef.current = onAutosaveStart; }, [onAutosaveStart]);
  useEffect(() => { onAutosaveSuccessRef.current = onAutosaveSuccess; }, [onAutosaveSuccess]);
  useEffect(() => { onAutosaveErrorRef.current = onAutosaveError; }, [onAutosaveError]);

  // Stable debounced autosave — created once, reads latest values via refs
  const debouncedAutosave = useRef(
    debounce(async (doc: EditorJsonDocument) => {
      if (!autosaveRef.current?.enabled || !onSaveRef.current) return;
      onAutosaveStartRef.current?.();
      try {
        const result = buildSaveResultRef.current(doc);
        await onSaveRef.current(result);
        setLastSaved(new Date());
        onAutosaveSuccessRef.current?.(result);
      } catch (err) {
        onAutosaveErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, autosave?.debounceMs ?? 1500),
  ).current;

  const handleChangeWithAutosave = useCallback(
    (doc: EditorJsonDocument) => {
      handleChange(doc);
      if (autosaveRef.current?.enabled) debouncedAutosave(doc);
    },
    [handleChange, debouncedAutosave],
  );

  // Keyboard shortcut: Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  // Apply CSS variables from theme
  const themeStyle = theme
    ? ({
        '--ae-brand': theme.brandColor ?? '',
        '--ae-radius': theme.radius === 'none' ? '0' : theme.radius === 'sm' ? '4px' : theme.radius === 'md' ? '8px' : theme.radius === 'lg' ? '12px' : theme.radius === 'full' ? '9999px' : '',
        '--ae-font': theme.fontFamily ?? '',
        '--ae-font-size': theme.fontSize ?? '',
        '--ae-line-height': theme.lineHeight ?? '',
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={[
        'ae-page-editor',
        `ae-page-editor--${mode}`,
        showInspector ? 'ae-page-editor--with-inspector' : '',
        isSaving ? 'ae-page-editor--saving' : '',
        readOnly ? 'ae-page-editor--readonly' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={themeStyle}
      data-ae
    >
      <div className="ae-page-editor__canvas">
        <EditorRoot
          ref={editorRef}
          value={value}
          onChange={handleChangeWithAutosave}
          placeholder={placeholder}
          editable={!readOnly && permissions.canEditText !== false}
          permissions={permissions}
          ai={ai}
          assets={assets}
          theme={theme}
          slashCommands={slashCommands}
          autofocus={autofocus}
        />
      </div>

      {showInspector && (
        <aside className="ae-page-editor__inspector" aria-label="Block inspector">
          <div className="ae-inspector__placeholder">Select a block to edit its properties.</div>
        </aside>
      )}

      <div className="ae-page-editor__status" aria-live="polite">
        {isSaving && <span className="ae-status ae-status--saving">Saving…</span>}
        {!isSaving && lastSaved && (
          <span className="ae-status ae-status--saved">
            Saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        {onSave && !autosave?.enabled && (
          <button
            className="ae-status__save-btn"
            onClick={save}
            disabled={isSaving}
            aria-label="Save document"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
}
