/**
 * @allebrum/page-editor
 *
 * Main entry point — exports all client-side components, types, and utilities.
 * Import this in React/Next.js client components.
 *
 * @example
 * import { PageEditor, ContentFieldEditor, PageRenderer } from '@allebrum/page-editor';
 * import '@allebrum/page-editor/styles.css';
 */

// ── Components ────────────────────────────────────────────────────────────────
export { PageEditor } from './components/PageEditor';
export { ContentFieldEditor } from './components/ContentFieldEditor';
export { PageRenderer } from './components/PageRenderer';
export { EditorRoot } from './components/EditorRoot';
export { BubbleToolbar } from './components/BubbleToolbar';
export { SlashCommandMenu } from './components/SlashCommandMenu';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  // Document model
  EditorJsonDocument,
  EditorJsonFragment,
  StoredEditorDocument,
  TranslatedEditorDocument,
  Block,
  TextNode,
  TextMark,
  GenericBlock,
  ParagraphBlock,
  HeadingBlock,
  BulletListBlock,
  OrderedListBlock,
  ListItemBlock,
  TaskListBlock,
  TaskItemBlock,
  BlockquoteBlock,
  CodeBlockBlock,
  HorizontalRuleBlock,
  HardBreakBlock,
  ImageBlock,
  ButtonBlock,
  CalloutBlock,
  SectionBlock,
  FlexRowBlock,
  FlexColumnBlock,
  SpacerBlock,
  HeroBlock,
  CardGridBlock,
  FaqBlock,
  EmbedBlock,
  SvgGraphicBlock,
  SvgGraphicNode,
  BackgroundConfig,
  TextAlignValue,
  // Assets
  EditorAsset,
  EditorAssetManifest,
  // Permissions
  EditorPermissions,
  // AI
  AiConfig,
  AiEditorAction,
  AiEditorRequest,
  AiEditorResponse,
  AiEditorResponseType,
  EditorSelectionPayload,
  // Asset config
  AssetConfig,
  // Block registry
  BlockDefinition,
  // Theme
  EditorTheme,
  // Translation
  TranslatableSegment,
  TranslationStatus,
  TranslationMap,
  // Slash commands
  SlashCommandItem,
  // Templates
  EditorTemplate,
  // Save
  EditorSaveResult,
} from './schema/types';

export type { AutosaveConfig, AutosaveCallbacks } from './storage/types';
export { CURRENT_SCHEMA_VERSION } from './storage/types';

// ── Serialization ─────────────────────────────────────────────────────────────
export { toHtml, toPlainText, toMarkdown, sanitizeHtml, extractTranslatableSegments, applyTranslations, migrateDocument } from './serialization';

// ── Schema / Registry ─────────────────────────────────────────────────────────
export { blockRegistry, registerBlock, getBlockDef, isBlockAllowed, BUILT_IN_BLOCK_DEFINITIONS } from './schema/blockRegistry';

// ── Extensions (for advanced customization) ───────────────────────────────────
export { SlashCommand } from './extensions/SlashCommand';
export { DocumentSection } from './extensions/DocumentSection';
export { FlexRow, FlexColumn } from './extensions/FlexRow';
export { CalloutBlock as CalloutExtension } from './extensions/CalloutBlock';
export { ButtonBlock as ButtonExtension } from './extensions/ButtonBlock';
export { SpacerBlock as SpacerExtension } from './extensions/SpacerBlock';
export { ImageBlock as ImageExtension } from './extensions/ImageBlock';
export { HeroBlock as HeroExtension } from './extensions/HeroBlock';
export { FaqBlock as FaqExtension, FaqItem as FaqItemExtension } from './extensions/FaqBlock';
export { EmbedBlock as EmbedExtension } from './extensions/EmbedBlock';
export { SvgGraphicBlock as SvgGraphicExtension } from './extensions/SvgGraphicBlock';
export { SvgGraphicNodeView } from './components/SvgGraphicNodeView';

// ── Utils ─────────────────────────────────────────────────────────────────────
export { buildSlashCommands } from './utils/slashCommands';
export { generateId } from './utils/ids';
export { debounce } from './utils/debounce';
export { buildAssetManifest } from './utils/assets';
export { renderVizTemplate, VIZ_TEMPLATE_REGISTRY } from './utils/vizTemplates/index';
export type { VizData, VizItem, VizRenderFn } from './utils/vizTemplates/types';

// ── AI client ─────────────────────────────────────────────────────────────────
export { callAiEndpoint } from './ai/aiClient';

// Component prop types
export type { PageEditorProps } from './components/PageEditor';
export type { ContentFieldEditorProps } from './components/ContentFieldEditor';
export type { PageRendererProps } from './components/PageRenderer';
export type { EditorRootProps, EditorRootHandle } from './components/EditorRoot';
