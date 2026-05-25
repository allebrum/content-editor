type SectionBackground = {
  type?: 'none' | 'color' | 'gradient' | 'image';
  color?: string;
  gradient?: string;
  imageUrl?: string;
  opacity?: number;
} | null | undefined;

function clampOpacity(value: unknown, fallback = 0.2): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function safeUrl(raw: string): string {
  return raw.replace(/["'\\\n\r]/g, '');
}

export function sectionBackgroundToCssValue(background: SectionBackground): string | null {
  if (!background || background.type === 'none') return null;

  if (background.type === 'color' && background.color) {
    return background.color;
  }

  if (background.type === 'gradient' && background.gradient) {
    return background.gradient;
  }

  if (background.type === 'image' && background.imageUrl) {
    const opacity = clampOpacity(background.opacity, 0.2);
    const url = safeUrl(background.imageUrl);
    return `linear-gradient(rgba(15,23,42,${opacity}),rgba(15,23,42,${opacity})),url("${url}") center / cover no-repeat`;
  }

  return null;
}

export function sectionBackgroundToStyle(background: SectionBackground): string | null {
  const cssValue = sectionBackgroundToCssValue(background);
  if (!cssValue) return null;
  return `background:${cssValue};`;
}
