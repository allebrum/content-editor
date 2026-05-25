export type { VizData, VizItem, VizRenderFn } from './types';
export { renderIdeas } from './ideas';
export { renderBubbles } from './bubbles';
export { renderQuadrant } from './quadrant';

import { renderIdeas } from './ideas';
import { renderBubbles } from './bubbles';
import { renderQuadrant } from './quadrant';
import type { VizData, VizRenderFn } from './types';

export const VIZ_TEMPLATE_REGISTRY: Record<string, VizRenderFn> = {
  // Map every known viz type key → render function
  // Types without a custom template fall back to 'ideas'
  ideas:                renderIdeas,
  bubbles:              renderBubbles,
  'bubble-steps':       renderBubbles,
  quadrant:             renderQuadrant,
  // Fallback all others to ideas until templates are built
  'arrow-bars':         renderIdeas,
  bullseye:             renderIdeas,
  chain:                renderIdeas,
  'concentric-circles': renderIdeas,
  'connected-circles':  renderIdeas,
  diamonds:             renderIdeas,
  'funnel-3d':          renderIdeas,
  gears:                renderIdeas,
  'hot-air-balloons':   renderIdeas,
  iceberg:              renderIdeas,
  infinity:             renderIdeas,
  inputs:               renderIdeas,
  'isometric-building': renderIdeas,
  'isometric-dashed-squares': renderIdeas,
  'isometric-globe':    renderIdeas,
  'linear-venn':        renderIdeas,
  'linear-venn-filled': renderIdeas,
  'minimal-funnel':     renderIdeas,
  'minimal-road':       renderIdeas,
  'nested-diamond':     renderIdeas,
  orbit:                renderIdeas,
  'packed-circles':     renderIdeas,
  pillar:               renderIdeas,
  pinwheel:             renderIdeas,
  puzzle:               renderIdeas,
  'ribbon-arrows':      renderIdeas,
  road:                 renderIdeas,
  'semi-circle-road':   renderIdeas,
  signs:                renderIdeas,
  slope:                renderIdeas,
  'solar-system':       renderIdeas,
  'square-arrows':      renderIdeas,
  swoosh:               renderIdeas,
  target:               renderIdeas,
  venn:                 renderIdeas,
  versus:               renderIdeas,
};

export function renderVizTemplate(vizType: string, data: VizData): string {
  const fn = VIZ_TEMPLATE_REGISTRY[vizType] ?? renderIdeas;
  return fn(data);
}
