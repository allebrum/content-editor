import type { VizData } from './types';
import { getIconForEmoji, iconSvgGroup } from './iconHelper';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Dark warm background matching the target reference aesthetic
const DARK_BG      = '#2d1f17';   // very dark brown
const CARD_COLOR   = '#c27040';   // terracotta/copper
const ACCENT_CIRCLE = '#f2d5c0';  // cream for the floating bubbles + icon circle
const HEADLINE_PILL = '#f2d5c0';  // same cream for headline pill
const HEADLINE_TEXT = '#2d1f17';  // dark text on light pill
const CARD_TEXT    = '#ffffff';   // white text on terracotta card
const ICON_COLOR   = '#2d1f17';   // dark icon on cream circle

// ── Layout constants ──────────────────────────────────────────────────────────
const VB_H       = 460;
const CARD_W     = 200;
const CARD_H_BASE = 220;
const CARD_H_TALL = 245;
const CARD_GAP   = 22;
const CARD_Y_MID = 185;
const CARD_Y_END = 162;
const CIRCLE_R1  = 40;   // large accent circle (overlaps card top) – also the icon circle
const CIRCLE_R2  = 19;
const CIRCLE_R3  = 9;
const ICON_SIZE  = 26;   // Lucide icon rendered size in px

const BG_PAD_X = 28;
const BG_PAD_TOP = 12;
const BG_PAD_BOT = 24;

// ── Font style embedded in SVG ────────────────────────────────────────────────
// Using Open Sans loaded via the package stylesheet; serif fallback for headline
const FONT_SANS   = "'Open Sans', 'Segoe UI', system-ui, sans-serif";
const FONT_SERIF  = "'Playfair Display', Georgia, serif";

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cardPositions(n: number, totalW: number): number[] {
  const totalCards = n * CARD_W + (n - 1) * CARD_GAP;
  const startX = (totalW - totalCards) / 2;
  return Array.from({ length: n }, (_, i) => startX + i * (CARD_W + CARD_GAP));
}

function accentCircles(cx: number, cardY: number, side: 'left' | 'right', fill: string): string {
  const dir = side === 'right' ? -1 : 1;
  const c1y = cardY + 2;
  const c2x = cx + dir * 50;  const c2y = cardY - 48;
  const c3x = cx + dir * 80;  const c3y = cardY - 86;
  return `
    <circle cx="${cx}" cy="${c1y}" r="${CIRCLE_R1}" fill="${fill}"/>
    <circle cx="${c2x}" cy="${c2y}" r="${CIRCLE_R2}" fill="${fill}"/>
    <circle cx="${c3x}" cy="${c3y}" r="${CIRCLE_R3}" fill="${fill}"/>`;
}

export function renderIdeas(data: VizData): string {
  const items = data.items.slice(0, 6);
  const n = Math.max(2, items.length);
  const headline = data.headline ?? '';

  const totalW = n * CARD_W + (n - 1) * CARD_GAP;
  const viewW = totalW + BG_PAD_X * 2 + 80;

  const xs = cardPositions(n, viewW);

  const bgH = VB_H;
  const cards = items.map((item, i) => {
    const x = xs[i];
    const isEnd = i === 0 || i === n - 1;
    const cardY = isEnd ? CARD_Y_END : CARD_Y_MID;
    const cardH = isEnd ? CARD_H_TALL : CARD_H_BASE;
    const circleCx = x + CARD_W / 2;
    const side: 'left' | 'right' = i < n / 2 ? 'left' : 'right';
    const textX = x + 16;
    const textW = CARD_W - 32;
    const textY = cardY + CIRCLE_R1 + 22;
    const textH = cardH - CIRCLE_R1 - 32;

    const Icon = getIconForEmoji(item.icon, i);
    const iconGroup = iconSvgGroup(Icon, circleCx, cardY + 2, ICON_SIZE, ICON_COLOR);

    return `
  <!-- card ${i + 1} -->
  <rect x="${x}" y="${cardY}" width="${CARD_W}" height="${cardH}" rx="8" fill="${CARD_COLOR}"/>
  ${accentCircles(circleCx, cardY, side, ACCENT_CIRCLE)}
  ${iconGroup}
  <foreignObject x="${textX}" y="${textY}" width="${textW}" height="${textH}" style="overflow:visible">
    <div xmlns="http://www.w3.org/1999/xhtml" class="ae-viz-text" data-viz-field="item-${i}-title"
      style="font-family:${FONT_SANS};font-size:16px;font-weight:600;color:${CARD_TEXT};text-align:center;word-break:break-word;line-height:1.35">${esc(item.title)}</div>
  </foreignObject>`;
  }).join('');

  const bannerW = Math.min(viewW * 0.5, 420);
  const bannerX = (viewW - bannerW) / 2;
  const headlineSvg = headline ? `
  <!-- headline pill -->
  <rect x="${bannerX}" y="18" width="${bannerW}" height="62" rx="20" fill="${HEADLINE_PILL}"/>
  <foreignObject x="${bannerX + 20}" y="24" width="${bannerW - 40}" height="50" style="overflow:visible">
    <div xmlns="http://www.w3.org/1999/xhtml" class="ae-viz-text" data-viz-field="headline"
      style="font-family:${FONT_SERIF};font-size:18px;font-weight:700;color:${HEADLINE_TEXT};text-align:center;padding:6px 0;word-break:break-word;line-height:1.3">${esc(headline)}</div>
  </foreignObject>` : '';

  return `<svg viewBox="0 0 ${viewW} ${bgH}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" overflow="visible" style="max-width:100%;display:block;border-radius:12px" data-viz-type="ideas">
  <!-- dark background -->
  <rect width="${viewW}" height="${bgH}" rx="12" fill="${DARK_BG}"/>
${headlineSvg}
${cards}
</svg>`;
}
