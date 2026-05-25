export interface VizItem {
  title: string;
  description?: string;
  icon?: string;  // emoji
}

export interface VizData {
  headline?: string;
  items: VizItem[];
  accentColor?: string;   // hex, defaults to template default
  bgColor?: string;       // hex, defaults to template default
}

export type VizRenderFn = (data: VizData) => string;
