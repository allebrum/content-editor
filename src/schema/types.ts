// ─────────────────────────────────────────────────────────────────────────────
// Editor document model
// ─────────────────────────────────────────────────────────────────────────────

export type EditorJsonDocument = {
  type: 'doc';
  content: Block[];
};

export type EditorJsonFragment = {
  type: string;
  content?: Block[];
  [key: string]: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// Stored document — canonical shape saved to database
// ─────────────────────────────────────────────────────────────────────────────

export type StoredEditorDocument = {
  id: string;
  schemaVersion: string;
  editor: 'allebrum-editor';
  document: EditorJsonDocument;
  assets: EditorAssetManifest;
  plainText: string;
  html?: string;
  translations?: Record<string, TranslatedEditorDocument>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TranslatedEditorDocument = {
  locale: string;
  document?: EditorJsonDocument;
  renderedHtml?: string;
  manuallyEdited?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Block types
// ─────────────────────────────────────────────────────────────────────────────

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | OrderedListBlock
  | ListItemBlock
  | TaskListBlock
  | TaskItemBlock
  | BlockquoteBlock
  | CodeBlockBlock
  | HorizontalRuleBlock
  | ImageBlock
  | ButtonBlock
  | CalloutBlock
  | SectionBlock
  | FlexRowBlock
  | FlexColumnBlock
  | SpacerBlock
  | SvgGraphicBlock
  | HeroBlock
  | CardGridBlock
  | FaqBlock
  | EmbedBlock
  | HardBreakBlock
  | TextNode
  | GenericBlock;

export type TextMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TextNode = {
  type: 'text';
  text: string;
  marks?: TextMark[];
};

export type GenericBlock = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Block[];
  marks?: TextMark[];
  text?: string;
};

export type ParagraphBlock = {
  type: 'paragraph';
  attrs?: { textAlign?: TextAlignValue };
  content?: Block[];
};

export type HeadingBlock = {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6; textAlign?: TextAlignValue };
  content?: Block[];
};

export type BulletListBlock = {
  type: 'bulletList';
  content?: Block[];
};

export type OrderedListBlock = {
  type: 'orderedList';
  attrs?: { start?: number };
  content?: Block[];
};

export type ListItemBlock = {
  type: 'listItem';
  content?: Block[];
};

export type TaskListBlock = {
  type: 'taskList';
  content?: Block[];
};

export type TaskItemBlock = {
  type: 'taskItem';
  attrs?: { checked?: boolean };
  content?: Block[];
};

export type BlockquoteBlock = {
  type: 'blockquote';
  content?: Block[];
};

export type CodeBlockBlock = {
  type: 'codeBlock';
  attrs?: { language?: string };
  content?: Block[];
};

export type HorizontalRuleBlock = {
  type: 'horizontalRule';
};

export type HardBreakBlock = {
  type: 'hardBreak';
};

export type ImageBlock = {
  type: 'image';
  attrs: {
    src: string;
    alt?: string;
    title?: string;
    width?: number | string;
    height?: number | string;
    assetId?: string;
    alignment?: 'left' | 'center' | 'right';
    caption?: string;
  };
};

export type ButtonBlock = {
  type: 'button';
  attrs: {
    id: string;
    label: string;
    href: string;
    target?: '_self' | '_blank';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  };
};

export type CalloutBlock = {
  type: 'callout';
  attrs: {
    id: string;
    icon?: string;
    variant?: 'info' | 'warning' | 'success' | 'error' | 'neutral';
  };
  content?: Block[];
};

export type BackgroundConfig = {
  type: 'none' | 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: string;
  imageUrl?: string;
  imageAssetId?: string;
  opacity?: number;
};

export type SectionBlock = {
  type: 'section';
  attrs: {
    id: string;
    variant?: 'default' | 'narrow' | 'wide' | 'fullBleed';
    background?: BackgroundConfig;
    backdrop?: BackgroundConfig;
    paddingY?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    fullBleed?: boolean;
    contentAlign?: 'top' | 'center' | 'bottom';
    cardWidth?: 'sm' | 'md' | 'lg';
  };
  content: Block[];
};

export type FlexRowBlock = {
  type: 'flexRow';
  attrs: {
    id: string;
    gap?: 'none' | 'sm' | 'md' | 'lg';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'between';
    responsive?: 'stackOnMobile' | 'scrollOnMobile' | 'preserve';
  };
  content: FlexColumnBlock[];
};

export type FlexColumnBlock = {
  type: 'flexColumn';
  attrs: {
    id: string;
    width?: 'auto' | '25' | '33' | '50' | '66' | '75' | '100';
  };
  content: Block[];
};

export type SpacerBlock = {
  type: 'spacer';
  attrs: { height?: 'sm' | 'md' | 'lg' | 'xl' | number };
};

export type HeroBlock = {
  type: 'hero';
  attrs: {
    id: string;
    variant?: 'centered' | 'split' | 'overlay';
    background?: BackgroundConfig;
    minHeight?: number | string;
  };
  content?: Block[];
};

export type CardGridBlock = {
  type: 'cardGrid';
  attrs: {
    id: string;
    columns?: 2 | 3 | 4;
    gap?: 'sm' | 'md' | 'lg';
  };
  content?: Block[];
};

export type FaqBlock = {
  type: 'faq';
  attrs: { id: string };
  content?: Block[];
};

export type EmbedBlock = {
  type: 'embed';
  attrs: {
    id: string;
    url: string;
    provider?: string;
    width?: number | string;
    height?: number | string;
    aspectRatio?: string;
  };
};

export type SvgGraphicBlock = {
  type: 'svgGraphic';
  attrs: {
    id: string;
    width: number;
    height: number;
    viewBox: string;
    theme?: 'light' | 'dark' | 'brand' | 'custom';
    prompt?: string;
    generatedBy?: string;
    createdAt?: string;
  };
  content: SvgGraphicNode[];
};

export type SvgGraphicNode =
  | {
      type: 'shape';
      tag: 'rect' | 'circle' | 'path' | 'line';
      attrs: Record<string, string | number>;
    }
  | {
      type: 'foreignObjectText';
      attrs: {
        x: number;
        y: number;
        width: number;
        height: number;
        className?: string;
      };
      html: string;
      editableText: string;
    };

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify';

// ─────────────────────────────────────────────────────────────────────────────
// Assets
// ─────────────────────────────────────────────────────────────────────────────

export type EditorAsset = {
  id: string;
  type: 'image' | 'video' | 'svg' | 'file';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  filename?: string;
  size?: number;
  metadata?: Record<string, unknown>;
};

export type EditorAssetManifest = {
  images: EditorAsset[];
  videos: EditorAsset[];
  svgs: EditorAsset[];
  files: EditorAsset[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────

export type EditorPermissions = {
  canEditText?: boolean;
  canEditLayout?: boolean;
  canUploadAssets?: boolean;
  canUseAi?: boolean;
  canEditRawHtml?: boolean;
  allowedBlocks?: string[];
  disallowedBlocks?: string[];
  lockedBlockIds?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// AI
// ─────────────────────────────────────────────────────────────────────────────

export type AiEditorAction =
  | 'improve-writing'
  | 'make-shorter'
  | 'make-longer'
  | 'change-tone'
  | 'fix-grammar'
  | 'summarize'
  | 'generate-headline'
  | 'generate-meta-description'
  | 'translate'
  | 'plain-language'
  | 'accessibility-rewrite'
  | 'expand'
  | 'generate-svg-graphic'
  | 'generate-image-prompt'
  | 'generate-section'
  | 'generate-alt-text';

export type EditorSelectionPayload = {
  text: string;
  html?: string;
  from: number;
  to: number;
};

export type AiEditorRequest = {
  action: AiEditorAction;
  selection?: EditorSelectionPayload;
  documentContext?: EditorJsonDocument;
  locale?: string;
  instructions?: string;
  projectContext?: Record<string, unknown>;
};

export type AiEditorResponseType =
  | 'replace-selection'
  | 'insert-after'
  | 'insert-block'
  | 'open-preview';

export type AiEditorResponse = {
  type: AiEditorResponseType;
  content: EditorJsonFragment | string;
  assets?: EditorAsset[];
  warnings?: string[];
};

export type AiConfig = {
  enabled: boolean;
  endpoint: string;
  headers?: Record<string, string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Asset config
// ─────────────────────────────────────────────────────────────────────────────

export type AssetConfig = {
  uploadEndpoint?: string;
  pickerEndpoint?: string;
  resolveUrl?: (asset: EditorAsset) => string;
  /**
   * Optional hook to open your app's media library.
   * Return null when user cancels.
   */
  openMediaPicker?: (request: MediaPickerRequest) => Promise<MediaPickerResult | null> | MediaPickerResult | null;
  /**
   * Placeholder image URL used when no picker is configured.
   */
  placeholderImageUrl?: string;
};

export type MediaPickerRequest = {
  kind: 'image';
  context: 'image-block' | 'section-background' | 'section-backdrop';
  currentUrl?: string;
};

export type MediaPickerResult = {
  url: string;
  alt?: string;
  assetId?: string;
  width?: number;
  height?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Block definition / registry
// ─────────────────────────────────────────────────────────────────────────────

export type BlockDefinition = {
  type: string;
  label: string;
  category: string;
  allowedChildren?: string[];
  allowedMarks?: string[];
  editableAttrs?: string[];
  editableText?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  aiEnabled?: boolean;
  exportable?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

export type EditorTheme = {
  brandColor?: string;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  sectionThemeColors?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Translation
// ─────────────────────────────────────────────────────────────────────────────

export type TranslatableSegment = {
  id: string;
  path: string;
  sourceText: string;
  context?: string;
  blockType?: string;
};

export type TranslationStatus = {
  locale: string;
  status: 'missing' | 'machine-translated' | 'human-reviewed' | 'outdated';
  sourceHash: string;
  translatedAt?: string;
  reviewedAt?: string;
};

export type TranslationMap = Record<string, string>;

// ─────────────────────────────────────────────────────────────────────────────
// Slash command
// ─────────────────────────────────────────────────────────────────────────────

export type SlashCommandItem = {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  insert: (params: { editor: import('@tiptap/core').Editor }) => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// Template
// ─────────────────────────────────────────────────────────────────────────────

export type EditorTemplate = {
  id: string;
  label: string;
  description?: string;
  category?: string;
  previewImage?: string;
  document: EditorJsonDocument;
};

// ─────────────────────────────────────────────────────────────────────────────
// Save result
// ─────────────────────────────────────────────────────────────────────────────

export type EditorSaveResult = {
  document: EditorJsonDocument;
  html: string;
  plainText: string;
  assets: EditorAssetManifest;
  schemaVersion: string;
};

// React import for types that reference React.ComponentType
import type React from 'react';
