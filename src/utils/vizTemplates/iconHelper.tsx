import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IconType } from 'react-icons';
import {
  LuSparkles, LuStar, LuZap, LuTarget, LuHeart, LuKey, LuRocket, LuLightbulb,
  LuMusic, LuMusic2, LuSun, LuCloudRain, LuPalette, LuGem, LuFlame, LuDollarSign,
  LuTrendingUp, LuPenLine, LuGlobe, LuTrophy, LuSmartphone, LuMonitor, LuLock,
  LuMail, LuCalendar, LuClock, LuSprout, LuMessageCircle, LuSearch, LuSettings,
  LuGraduationCap, LuHouse, LuCar, LuMegaphone, LuHandshake, LuAtom, LuBrain,
  LuBuilding, LuLeaf, LuCloud, LuDroplets, LuWaves, LuMountain, LuAward,
  LuShield, LuBookOpen, LuUsers, LuUser, LuArrowRight, LuLayers, LuDatabase,
  LuCode, LuPackage, LuGift, LuListChecks, LuPenTool, LuCompass, LuMap,
  LuMoon, LuFeather, LuAnchor, LuChartBar, LuSunrise,
} from 'react-icons/lu';

// ── Emoji → Lucide icon mapping ───────────────────────────────────────────────
export const EMOJI_ICON_MAP: Record<string, IconType> = {
  '💡': LuLightbulb,   '🚀': LuRocket,       '🎯': LuTarget,
  '⚡': LuZap,          '🌟': LuStar,          '⭐': LuStar,
  '🔑': LuKey,          '✨': LuSparkles,       '➡️': LuArrowRight,
  '🎵': LuMusic,        '🎶': LuMusic2,         '🎸': LuMusic,
  '☀️': LuSun,          '🌧️': LuCloudRain,     '🌈': LuSunrise,
  '🎨': LuPalette,      '💎': LuGem,            '🔥': LuFlame,
  '💰': LuDollarSign,   '📊': LuChartBar,      '📝': LuPenLine,
  '🌍': LuGlobe,        '🌎': LuGlobe,          '🌐': LuGlobe,
  '💪': LuAward,        '🤝': LuHandshake,      '❤️': LuHeart,
  '🏆': LuTrophy,       '📱': LuSmartphone,     '💻': LuMonitor,
  '🔒': LuLock,         '📧': LuMail,           '📅': LuCalendar,
  '⏰': LuClock,        '⏱️': LuClock,          '🌱': LuSprout,
  '💬': LuMessageCircle,'🔍': LuSearch,         '⚙️': LuSettings,
  '🎓': LuGraduationCap,'🏠': LuHouse,          '🚗': LuCar,
  '📢': LuMegaphone,    '⚛️': LuAtom,           '🧠': LuBrain,
  '🏢': LuBuilding,     '🍃': LuLeaf,           '☁️': LuCloud,
  '💧': LuDroplets,     '🌊': LuWaves,          '⛰️': LuMountain,
  '🏅': LuAward,        '🛡️': LuShield,         '📖': LuBookOpen,
  '👥': LuUsers,        '👤': LuUser,            '🎁': LuGift,
  '📦': LuPackage,      '🗺️': LuMap,            '🧭': LuCompass,
  '🌙': LuMoon,         '🪶': LuFeather,         '⚓': LuAnchor,
  '🔗': LuLayers,       '🗄️': LuDatabase,       '🖥️': LuCode,
  '✅': LuListChecks,   '🖊️': LuPenTool,
  '🌿': LuSprout,       '📈': LuTrendingUp,
};

// Fallback cycling icons when emoji isn't in the map
const FALLBACK_ICONS: IconType[] = [
  LuSparkles, LuStar, LuZap, LuHeart, LuTarget, LuKey,
  LuRocket, LuLightbulb, LuAward, LuGem,
];

export function getIconForEmoji(emoji: string | undefined, index: number): IconType {
  if (emoji) {
    const mapped = EMOJI_ICON_MAP[emoji];
    if (mapped) return mapped;
    // Try first char
    const mapped2 = EMOJI_ICON_MAP[emoji[0]];
    if (mapped2) return mapped2;
  }
  return FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

/**
 * Renders a react-icon component to a positioned SVG <g> element.
 * The icon is centered at (cx, cy) and scaled to `size` pixels.
 */
export function iconSvgGroup(
  Icon: IconType,
  cx: number,
  cy: number,
  size: number,
  color: string,
  strokeWidth = 1.75,
): string {
  // Render the react-icon to static markup (works in browser via react-dom/server)
  const markup = renderToStaticMarkup(
    createElement(Icon as React.ComponentType<Record<string, unknown>>, {
      size: 24,
      color,
      strokeWidth,
    }),
  );

  // Extract inner SVG content — strip the outer <svg> wrapper
  const inner = markup
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    // Replace inline currentColor with actual color
    .replace(/currentColor/g, color);

  const scale = size / 24;
  const tx = cx - size / 2;
  const ty = cy - size / 2;

  return `<g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>`;
}
