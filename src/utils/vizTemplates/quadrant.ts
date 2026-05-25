import type { VizData } from './types';

const DEFAULT_ACCENT = '#3b82f6';
const DEFAULT_BG     = '#eff6ff';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderQuadrant(data: VizData): string {
  // Quadrant always shows exactly 4 items (pad or trim)
  const raw = data.items.slice(0, 4);
  while (raw.length < 4) raw.push({ title: '', icon: '' });
  const accent = data.accentColor ?? DEFAULT_ACCENT;
  const bg = data.bgColor ?? DEFAULT_BG;
  const headline = data.headline ?? '';

  const CELL_W = 220;
  const CELL_H = 180;
  const AXIS_STROKE = 2;
  const PAD = 60;
  const LABEL_OFFSET = 24;
  const totalW = CELL_W * 2 + PAD * 2;
  const totalH = CELL_H * 2 + PAD * 2 + (headline ? 60 : 20);
  const originX = PAD + CELL_W;
  const originY = (headline ? 60 : 20) + PAD + CELL_H;

  const quadrants = [
    { i: 0, dx: -CELL_W, dy: -CELL_H, label: 'Q1' },
    { i: 1, dx: 0,       dy: -CELL_H, label: 'Q2' },
    { i: 2, dx: -CELL_W, dy: 0,       label: 'Q3' },
    { i: 3, dx: 0,       dy: 0,       label: 'Q4' },
  ];

  const cells = quadrants.map(({ i, dx, dy }) => {
    const item = raw[i];
    const rx = originX + dx;
    const ry = originY + dy;
    const isTop = dy < 0;
    const isLeft = dx < 0;
    const r = 8;
    const corners = isTop
      ? (isLeft ? `${r} 0 0 0` : `0 ${r} 0 0`)
      : (isLeft ? `0 0 0 ${r}` : `0 0 ${r} 0`);
    return `
  <rect x="${rx}" y="${ry}" width="${CELL_W}" height="${CELL_H}" fill="${bg}" rx="${r}" ry="${r}"/>
  <foreignObject x="${rx + 12}" y="${ry + 14}" width="${CELL_W - 24}" height="${CELL_H - 28}" style="overflow:visible">
    <div xmlns="http://www.w3.org/1999/xhtml" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
      <div style="font-size:26px;line-height:1">${item.icon ?? ''}</div>
      <div class="ae-viz-text" data-viz-field="item-${i}-title" style="font-size:13px;font-weight:700;color:#1e293b;text-align:center;word-break:break-word">${esc(item.title)}</div>
      <div class="ae-viz-text" data-viz-field="item-${i}-desc" style="font-size:11px;color:#64748b;text-align:center;word-break:break-word">${esc(item.description ?? '')}</div>
    </div>
  </foreignObject>`;
  }).join('');

  const headlineSvg = headline ? `
  <text x="${totalW / 2}" y="36" text-anchor="middle" fill="#1e293b" font-size="18" font-weight="700">${esc(headline)}</text>` : '';

  const axisTop = originY - CELL_H - LABEL_OFFSET;
  const axisBottom = originY + CELL_H + LABEL_OFFSET;
  const axisLeft = originX - CELL_W - LABEL_OFFSET;
  const axisRight = originX + CELL_W + LABEL_OFFSET;

  return `<svg viewBox="0 0 ${totalW} ${totalH}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" overflow="visible" style="max-width:100%;display:block" data-viz-type="quadrant">
${headlineSvg}
${cells}
  <!-- axes -->
  <line x1="${originX}" y1="${axisTop}" x2="${originX}" y2="${axisBottom}" stroke="${accent}" stroke-width="${AXIS_STROKE}"/>
  <line x1="${axisLeft}" y1="${originY}" x2="${axisRight}" y2="${originY}" stroke="${accent}" stroke-width="${AXIS_STROKE}"/>
  <!-- axis arrowheads -->
  <polygon points="${originX},${axisTop} ${originX - 5},${axisTop + 10} ${originX + 5},${axisTop + 10}" fill="${accent}"/>
  <polygon points="${axisRight},${originY} ${axisRight - 10},${originY - 5} ${axisRight - 10},${originY + 5}" fill="${accent}"/>
</svg>`;
}
