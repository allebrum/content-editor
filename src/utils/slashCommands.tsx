import {
  LuPilcrow, LuHeading1, LuHeading2, LuHeading3,
  LuList, LuListOrdered, LuListChecks, LuQuote, LuCode,
  LuColumns2, LuColumns3, LuLayoutTemplate, LuArrowUpDown, LuMinus,
  LuImage, LuGlobe,
  LuInfo, LuMousePointerClick, LuLayoutDashboard, LuCircleHelp, LuSparkles,
} from 'react-icons/lu';
import type { SlashCommandItem } from '../schema/types';
import type { Editor } from '@tiptap/core';

type InsertFn = (params: { editor: Editor }) => void;

function ins(fn: InsertFn): InsertFn {
  return fn;
}

type BuildSlashCommandOptions = {
  onInsertImage?: (editor: Editor) => void;
};

function createBuiltInCommands(options?: BuildSlashCommandOptions): SlashCommandItem[] {
  return [
  // Text
  {
    id: 'paragraph',
    label: 'Paragraph',
    description: 'Plain text paragraph',
    group: 'Text',
    keywords: ['text', 'p'],
    icon: LuPilcrow,
    insert: ins(({ editor }) => editor.chain().focus().setParagraph().run()),
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    group: 'Text',
    keywords: ['h1', 'title'],
    icon: LuHeading1,
    insert: ins(({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run()),
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    group: 'Text',
    keywords: ['h2', 'subtitle'],
    icon: LuHeading2,
    insert: ins(({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run()),
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    group: 'Text',
    keywords: ['h3'],
    icon: LuHeading3,
    insert: ins(({ editor }) => editor.chain().focus().toggleHeading({ level: 3 }).run()),
  },
  {
    id: 'bulletList',
    label: 'Bulleted list',
    description: 'Unordered list',
    group: 'Text',
    keywords: ['ul', 'list', 'bullet'],
    icon: LuList,
    insert: ins(({ editor }) => editor.chain().focus().toggleBulletList().run()),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    description: 'Ordered list',
    group: 'Text',
    keywords: ['ol', 'numbered', '1.'],
    icon: LuListOrdered,
    insert: ins(({ editor }) => editor.chain().focus().toggleOrderedList().run()),
  },
  {
    id: 'taskList',
    label: 'Checklist',
    description: 'Checkbox task list',
    group: 'Text',
    keywords: ['todo', 'check', 'task'],
    icon: LuListChecks,
    insert: ins(({ editor }) => editor.chain().focus().toggleTaskList().run()),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Block quote',
    group: 'Text',
    keywords: ['quote', 'blockquote'],
    icon: LuQuote,
    insert: ins(({ editor }) => editor.chain().focus().toggleBlockquote().run()),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    description: 'Monospace code snippet',
    group: 'Text',
    keywords: ['code', 'pre', 'monospace'],
    icon: LuCode,
    insert: ins(({ editor }) => editor.chain().focus().toggleCodeBlock().run()),
  },
  // Layout
  {
    id: 'twoColumn',
    label: 'Two-column row',
    description: 'Side-by-side columns',
    group: 'Layout',
    keywords: ['two column', '2 column', 'columns', 'row', 'flex'],
    icon: LuColumns2,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'flexRow',
        attrs: { id: crypto.randomUUID(), gap: 'md', responsive: 'stackOnMobile' },
        content: [
          { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: 'auto' }, content: [{ type: 'paragraph' }] },
          { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: 'auto' }, content: [{ type: 'paragraph' }] },
        ],
      }).run();
    }),
  },
  {
    id: 'threeColumn',
    label: 'Three-column row',
    description: 'Three equal columns',
    group: 'Layout',
    keywords: ['three column', '3 column', 'columns', 'row'],
    icon: LuColumns3,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'flexRow',
        attrs: { id: crypto.randomUUID(), gap: 'md', responsive: 'stackOnMobile' },
        content: [
          { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: 'auto' }, content: [{ type: 'paragraph' }] },
          { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: 'auto' }, content: [{ type: 'paragraph' }] },
          { type: 'flexColumn', attrs: { id: crypto.randomUUID(), width: 'auto' }, content: [{ type: 'paragraph' }] },
        ],
      }).run();
    }),
  },
  {
    id: 'section',
    label: 'Section',
    description: 'Page section with background/padding',
    group: 'Layout',
    keywords: ['section', 'container'],
    icon: LuLayoutTemplate,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'section',
        attrs: { id: crypto.randomUUID(), variant: 'default', paddingY: 'md' },
        content: [{ type: 'paragraph' }],
      }).run();
    }),
  },
  {
    id: 'spacer',
    label: 'Spacer',
    description: 'Vertical spacing block',
    group: 'Layout',
    keywords: ['space', 'gap', 'blank'],
    icon: LuArrowUpDown,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({ type: 'spacer', attrs: { height: 'md' } }).run();
    }),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Horizontal rule',
    group: 'Layout',
    keywords: ['hr', 'rule', 'line', 'divider'],
    icon: LuMinus,
    insert: ins(({ editor }) => editor.chain().focus().setHorizontalRule().run()),
  },
  // Media
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed an image',
    group: 'Media',
    keywords: ['photo', 'picture', 'img'],
    icon: LuImage,
    insert: ins(({ editor }) => {
      if (options?.onInsertImage) {
        options.onInsertImage(editor);
        return;
      }
      const url = window.prompt('Image URL:');
      if (!url) return;
      editor.chain().focus().insertContent({
        type: 'imageBlock',
        attrs: { src: url, alt: '', alignment: 'center' },
      }).run();
    }),
  },
  {
    id: 'embed',
    label: 'Embed',
    description: 'Embed a URL (video, map, etc.)',
    group: 'Media',
    keywords: ['video', 'youtube', 'vimeo', 'iframe', 'embed'],
    icon: LuGlobe,
    insert: ins(({ editor }) => {
      const url = window.prompt('Embed URL:');
      if (url) {
        editor.chain().focus().insertContent({
          type: 'embed',
          attrs: { id: crypto.randomUUID(), url },
        }).run();
      }
    }),
  },
  // Blocks
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlighted note or alert',
    group: 'Blocks',
    keywords: ['note', 'alert', 'info', 'warning', 'tip'],
    icon: LuInfo,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { id: crypto.randomUUID(), icon: 'ℹ️', variant: 'info' },
        content: [{ type: 'paragraph' }],
      }).run();
    }),
  },
  {
    id: 'button',
    label: 'Button',
    description: 'Call-to-action button',
    group: 'Blocks',
    keywords: ['cta', 'link', 'btn'],
    icon: LuMousePointerClick,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'button',
        attrs: { id: crypto.randomUUID(), label: 'Click here', href: '#', variant: 'primary', size: 'md' },
      }).run();
    }),
  },
  {
    id: 'hero',
    label: 'Hero section',
    description: 'Full-width page hero',
    group: 'Blocks',
    keywords: ['banner', 'header', 'hero', 'top'],
    icon: LuLayoutDashboard,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'hero',
        attrs: { id: crypto.randomUUID(), variant: 'centered' },
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Your Headline' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Your subtitle or description.' }] },
        ],
      }).run();
    }),
  },
  {
    id: 'faq',
    label: 'FAQ block',
    description: 'Expandable questions and answers',
    group: 'Blocks',
    keywords: ['questions', 'accordion', 'faq'],
    icon: LuCircleHelp,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'faq',
        attrs: { id: crypto.randomUUID() },
        content: [
          {
            type: 'faqItem',
            attrs: { id: crypto.randomUUID() },
            content: [
              { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Question?' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Answer.' }] },
            ],
          },
        ],
      }).run();
    }),
  },
  {
    id: 'svgGraphic',
    label: 'Visualization',
    description: 'AI-generated visual diagram',
    group: 'Blocks',
    keywords: ['svg', 'diagram', 'visual', 'chart', 'infographic', 'ai'],
    icon: LuSparkles,
    insert: ins(({ editor }) => {
      editor.chain().focus().insertContent({
        type: 'svgGraphic',
        attrs: {
          id: crypto.randomUUID(),
          svgContent: '',
          prompt: '',
          visualizationType: 'ideas',
          generatedBy: 'ai',
          createdAt: new Date().toISOString(),
        },
      }).run();
    }),
  },
  ];
}

export function buildSlashCommands(custom: SlashCommandItem[] = [], options?: BuildSlashCommandOptions): SlashCommandItem[] {
  return [...createBuiltInCommands(options), ...custom];
}
