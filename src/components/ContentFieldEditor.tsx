import React from 'react';
import type {
  EditorJsonDocument,
  EditorPermissions,
  AiConfig,
  AssetConfig,
  EditorTheme,
  SlashCommandItem,
} from '../schema/types';
import { EditorRoot } from './EditorRoot';

export interface ContentFieldEditorProps {
  /** Controlled value */
  value?: EditorJsonDocument | null;
  /** Called on content change */
  onChange?: (doc: EditorJsonDocument) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum height in px */
  minHeight?: number;
  /** Maximum height in px */
  maxHeight?: number;
  /** Which block types to allow (restricts slash menu and paste) */
  allowedBlocks?: string[];
  /** AI configuration */
  ai?: AiConfig;
  /** Asset upload/picker configuration */
  assets?: AssetConfig;
  /** User permissions override */
  permissions?: EditorPermissions;
  /** Extra slash commands */
  slashCommands?: SlashCommandItem[];
  /** Additional CSS class */
  className?: string;
  /** Visual theme overrides */
  theme?: EditorTheme;
  /** Autofocus on mount */
  autofocus?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

export function ContentFieldEditor({
  value,
  onChange,
  placeholder = 'Write something…',
  minHeight,
  maxHeight,
  allowedBlocks,
  ai,
  assets,
  permissions = {},
  slashCommands,
  className,
  theme,
  autofocus = false,
  readOnly = false,
}: ContentFieldEditorProps) {
  const mergedPermissions: EditorPermissions = {
    ...permissions,
    allowedBlocks: allowedBlocks ?? permissions.allowedBlocks,
  };

  const style: React.CSSProperties = {};
  if (minHeight) style.minHeight = minHeight;
  if (maxHeight) { style.maxHeight = maxHeight; style.overflowY = 'auto'; }

  return (
    <div
      className={[
        'ae-field-editor',
        readOnly ? 'ae-field-editor--readonly' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-ae
    >
      <EditorRoot
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        editable={!readOnly && permissions.canEditText !== false}
        permissions={mergedPermissions}
        ai={ai}
        assets={assets}
        theme={theme}
        slashCommands={slashCommands}
        autofocus={autofocus}
      />
    </div>
  );
}
