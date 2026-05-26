import React, { forwardRef, useImperativeHandle, useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import { type Editor } from '@tiptap/core';

import type { EditorJsonDocument, EditorPermissions, AiConfig, AssetConfig, EditorTheme, SlashCommandItem } from '../schema/types';
import { DocumentSection } from '../extensions/DocumentSection';
import { FlexRow, FlexColumn } from '../extensions/FlexRow';
import { CalloutBlock } from '../extensions/CalloutBlock';
import { ButtonBlock } from '../extensions/ButtonBlock';
import { SpacerBlock } from '../extensions/SpacerBlock';
import { ImageBlock } from '../extensions/ImageBlock';
import { HeroBlock } from '../extensions/HeroBlock';
import { FaqBlock, FaqItem } from '../extensions/FaqBlock';
import { EmbedBlock } from '../extensions/EmbedBlock';
import { SvgGraphicBlock } from '../extensions/SvgGraphicBlock';
import { SlashCommand } from '../extensions/SlashCommand';
import { buildSlashCommands } from '../utils/slashCommands';
import { pickImageAsset } from '../utils/imagePicker';
import { SlashCommandMenu } from './SlashCommandMenu';
import { BubbleToolbar } from './BubbleToolbar';
import { BlockHandle } from './BlockHandle';
import { SectionAddControls } from './SectionAddControls';
import { BlankLineQuickActions } from './BlankLineQuickActions';

function createDefaultSection() {
  return {
    type: 'section',
    attrs: { id: crypto.randomUUID(), variant: 'default', cardWidth: 'md', paddingY: 'md', fullBleed: true, contentAlign: 'top' },
    content: [{ type: 'paragraph' }],
  } as const;
}

function normalizeTopLevelSections(doc: EditorJsonDocument): EditorJsonDocument {
  const input = Array.isArray(doc.content) ? doc.content : [];
  if (input.length === 0) {
    return { type: 'doc', content: [createDefaultSection()] as unknown as EditorJsonDocument['content'] };
  }

  const normalized: unknown[] = [];
  let looseBlocks: unknown[] = [];

  const flushLoose = () => {
    if (!looseBlocks.length) return;
    normalized.push({
      type: 'section',
      attrs: { id: crypto.randomUUID(), variant: 'default', cardWidth: 'md', paddingY: 'md', fullBleed: true, contentAlign: 'top' },
      content: looseBlocks,
    });
    looseBlocks = [];
  };

  for (const block of input as unknown as Array<{ type?: string }>) {
    if (block?.type === 'section') {
      flushLoose();
      normalized.push(block);
    } else {
      looseBlocks.push(block);
    }
  }
  flushLoose();

  if (!normalized.length) {
    normalized.push(createDefaultSection());
  }

  return { type: 'doc', content: normalized as EditorJsonDocument['content'] };
}

export interface EditorRootProps {
  value?: EditorJsonDocument | null;
  onChange?: (doc: EditorJsonDocument) => void;
  placeholder?: string;
  editable?: boolean;
  permissions?: EditorPermissions;
  ai?: AiConfig;
  assets?: AssetConfig;
  theme?: EditorTheme;
  slashCommands?: SlashCommandItem[];
  autofocus?: boolean | 'start' | 'end' | 'all';
  className?: string;
}

export interface EditorRootHandle {
  getEditor: () => Editor | null;
  focus: () => void;
  getJson: () => EditorJsonDocument | null;
}

export const EditorRoot = forwardRef<EditorRootHandle, EditorRootProps>(function EditorRoot(
  {
    value,
    onChange,
    placeholder = 'Start writing, or type / for commands…',
    editable = true,
    permissions = {},
    ai,
    theme,
    slashCommands: customCommands = [],
    autofocus = false,
    assets,
    className,
  },
  ref,
) {
  const slashMenuRef = useRef<{ open: (props: unknown) => void; close: () => void } | null>(null);
  const isNormalizingRef = useRef(false);

  const onInsertImage = useCallback(
    async (ed: Editor) => {
      const picked = await pickImageAsset(assets, { kind: 'image', context: 'image-block' });
      if (!picked?.url) return;
      ed.chain().focus().insertContent({
        type: 'imageBlock',
        attrs: {
          src: picked.url,
          alt: picked.alt ?? '',
          assetId: picked.assetId,
          width: picked.width,
          height: picked.height,
          alignment: 'center',
        },
      }).run();
    },
    [assets],
  );

  const slashCommands = useMemo(
    () => buildSlashCommands(customCommands, { onInsertImage: (ed) => { void onInsertImage(ed); } }),
    [customCommands, onInsertImage],
  );

  const editor = useEditor({
    editable,
    autofocus,
    extensions: [
      StarterKit.configure({
        history: { depth: 100 },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) return 'Untitled Section';
          return placeholder;
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight,
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      DocumentSection,
      FlexRow,
      FlexColumn,
      CalloutBlock,
      ButtonBlock,
      SpacerBlock,
      ImageBlock,
      HeroBlock,
      FaqBlock,
      FaqItem,
      EmbedBlock,
      SvgGraphicBlock,
      SlashCommand.configure({
        commands: slashCommands,
        suggestion: {
          char: '/',
          items: ({ query }: { query: string }) => {
            if (!query) return slashCommands;
            const q = query.toLowerCase();
            return slashCommands.filter(
              (cmd) =>
                cmd.label.toLowerCase().includes(q) ||
                (cmd.keywords ?? []).some((k) => k.includes(q)) ||
                cmd.group.toLowerCase().includes(q),
            );
          },
          render: () => {
            let component: ReturnType<typeof SlashCommandMenu> | null = null;
            let el: HTMLElement | null = null;

            return {
              onStart: (props: unknown) => {
                el = document.createElement('div');
                document.body.appendChild(el);
                slashMenuRef.current?.open(props);
              },
              onUpdate: (props: unknown) => {
                slashMenuRef.current?.open(props);
              },
              onKeyDown: ({ event }: { event: KeyboardEvent }) => {
                if (event.key === 'Escape') {
                  slashMenuRef.current?.close();
                  return true;
                }
                return false;
              },
              onExit: () => {
                slashMenuRef.current?.close();
                if (el) {
                  el.remove();
                  el = null;
                }
                component = null;
              },
            };
          },
          command: ({ editor: ed, range, props }: { editor: Editor; range: { from: number; to: number }; props: SlashCommandItem }) => {
            ed.chain().focus().deleteRange(range).run();
            props.insert({ editor: ed });
          },
        },
      }),
    ],
    content: normalizeTopLevelSections(value ?? { type: 'doc', content: [{ type: 'paragraph' }] }),
    onUpdate: ({ editor: ed }) => {
      const current = ed.getJSON() as EditorJsonDocument;
      const normalized = normalizeTopLevelSections(current);

      if (!isNormalizingRef.current && JSON.stringify(current) !== JSON.stringify(normalized)) {
        isNormalizingRef.current = true;
        ed.commands.setContent(normalized, false);
        return;
      }

      if (isNormalizingRef.current) {
        isNormalizingRef.current = false;
      }

      if (onChange) {
        onChange(ed.getJSON() as EditorJsonDocument);
      }
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => editor ?? null,
    focus: () => editor?.commands.focus(),
    getJson: () => (editor?.getJSON() as EditorJsonDocument) ?? null,
  }));

  const canUseAi = permissions.canUseAi !== false && ai?.enabled;

  // Inject aiConfig into SvgGraphicBlock storage so NodeViews can call the AI endpoint
  useEffect(() => {
    if (editor && editor.storage.svgGraphic !== undefined) {
      editor.storage.svgGraphic.aiConfig = canUseAi ? ai : null;
    }
  }, [editor, ai, canUseAi]);

  // ── File drag-and-drop → upload + insert image block ─────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();

      if (!assets?.uploadEndpoint) {
        // No upload endpoint configured — fall back to object URL (preview only)
        files.forEach((file) => {
          const url = URL.createObjectURL(file);
          editor?.chain().focus().insertContent({ type: 'image', attrs: { src: url, alt: file.name } }).run();
        });
        return;
      }

      for (const file of files) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await fetch(assets.uploadEndpoint, { method: 'POST', body: fd });
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
          const data = await res.json();
          const asset = data.asset ?? data;
          editor?.chain().focus().insertContent({
            type: 'image',
            attrs: { src: asset.url, alt: asset.filename ?? file.name },
          }).run();
        } catch (err) {
          console.error('[allebrum] image upload failed', err);
        }
      }
    },
    [assets, editor],
  );

  return (
    <div
      className={`ae-editor-root${className ? ' ' + className : ''}`}
      data-ae
      data-ae-edit=""
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {editor && <BubbleToolbar editor={editor} aiConfig={canUseAi ? ai : undefined} />}
      {editor && <BlockHandle editor={editor} assets={assets} />}
      {editor && <SectionAddControls editor={editor} aiConfig={canUseAi ? ai : undefined} theme={theme} assets={assets} />}
      {editor && <BlankLineQuickActions editor={editor} assets={assets} />}
      <EditorContent editor={editor} className="ae-editor-content" />
      <SlashCommandMenu ref={slashMenuRef} editor={editor ?? null} />
    </div>
  );
});
