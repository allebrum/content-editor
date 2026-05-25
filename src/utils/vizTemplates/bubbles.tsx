import type { VizData } from './types';
import { getIconForEmoji, iconSvgGroup } from './iconHelper';

// ── Design tokens ─────────────────────────────────────────────────────────────
const DARK_BG     = '#2d1f17';
const BUBBLE_COLOR = '#c27040';    // terracotta bubble fill
const ACCENT_RING  = '#f2d5c0';    // cream ring around bubbles
const ICON_COLOR   = '#2d1f17';    // dark icon on cream ring
const ICON_BG      = '#f2d5c0';    // cream circle behind icon
const LINE_COLOR   = '#c2704066';  // semi-transparent terracotta connector lines
const LABEL_TEXT   = '#ffffff';
const DESC_TEXT    = '#f5ddd0';

const FONT_SANS  = "'Open Sans', 'Segoe UI', system-ui, sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

const VB_W = 800;
const VB_H = 420;
const BUBBLE_R    = 52;   // main step bubble radius
const ICON_RING_R = 38;   // cream inner circle for icon
const ICON_SIZE   = 28;
const CENTER_X    = VB_W / 2;
const CENTER_Y    = VB_H / 2 + 10;
const ORBIT_R     = 165;  // radius of the ring layout

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Distribute n bubbles evenly around a circle, starting from the top */
function positions(n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CENTER_X + ORBIT_R * Math.cos(angle),
      y: CENTER_Y + ORBIT_R * Math.sin(angle),
    };
  });
}

export function renderBubbles(data: VizData): string {
  const items = data.items.slice(0, 6);
  const n = Math.max(2, items.length);
  const headline = data.headline ?? '';
  const pos = positions(n);

  const connectors = pos.map((p, i) => {
    const next = pos[(i + 1) % n];
    const mx = (p.x + next.x) / 2;
    const my = (p.y + next.y) / 2;
    return `<path d="M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}" fill="none" stroke="${LINE_COLOR}" stroke-width="2"/>`;
  }).join('\n  ');

  const bubbles = items.map((item, i) => {
    const { x, y } = pos[i];
    const Icon = getIconForEmoji(item.icon, i);
    const iconGroup = iconSvgGroup(Icon, x, y, ICON_SIZE, ICON_COLOR);
    const label = esc(item.title);
    // Label below bubble
    const labelY = y + BUBBLE_R + 14;
    // Description two rows below label (optional short desc)
    const shortDesc = item.description ? esc(item.description.slice(0, 48)) : '';

    return `
  <!-- bubble ${i + 1} -->
  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${BUBBLE_R}" fill="${BUBBLE_COLOR}"/>
  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ICON_RING_R}" fill="${ICON_BG}"/>
  ${iconGroup}
  <text x="${x.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-family="${FONT_SANS}" font-size="14" font-weight="700" fill="${LABEL_TEXT}">${label}</text>
  ${shortDesc ? `<text x="${x.toFixed(1)}" y="${(labelY + 17).toFixed(1)}" text-anchor="middle" font-family="${FONT_SANS}" font-size="12" fill="${DESC_TEXT}">${shortDesc}</text>` : ''}`;
  }).join('');

  const headlineSvg = headline ? `
  <!-- center headline -->
  <circle cx="${CENTER_X}" cy="${CENTER_Y}" r="64" fill="${BUBBLE_COLOR}" opacity="0.6"/>
  <foreignObject x="${CENTER_X - 54}" y="${CENTER_Y - 36}" width="108" height="72" style="overflow:visible">
    <div xmlns="http://www.w3.org/1999/xhtml" class="ae-viz-text" data-viz-field="headline"
      style="font-family:${FONT_SERIF};font-size:13px;font-weight:700;color:#fff;text-align:center;word-break:break-word;line-height:1.3;padding:2px">${esc(headline)}</div>
  </foreignObject>` : '';

  return `<svg viewBox="0 0 ${VB_W} ${VB_H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" style="max-width:100%;display:block;border-radius:12px" data-viz-type="bubbles">
  <!-- dark background -->
  <rect width="${VB_W}" height="${VB_H}" rx="12" fill="${DARK_BG}"/>
  ${connectors}
${bubbles}
${headlineSvg}
</svg>`;
}
