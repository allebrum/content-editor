/**
 * Image and video helpers for version 2 documents. DOM-free.
 *
 * Video is embed-only: a document never stores an iframe or arbitrary URL.
 * Renderers rebuild a fixed provider URL from `{ provider, videoId, hash }`.
 */
import type { VideoBlock, VideoProvider } from './types';

export const MAX_URL_LENGTH = 2048;
export const MAX_ALT_LENGTH = 500;
export const MAX_CAPTION_LENGTH = 1000;
export const MIN_IMAGE_WIDTH = 40;
export const MAX_IMAGE_WIDTH = 4000;

/** Providers allowed when a host does not pass its own list. YouTube is opt-in. */
export const DEFAULT_VIDEO_PROVIDERS: readonly VideoProvider[] = ['vimeo'];

const VIMEO_ID = /^\d{1,12}$/;
const VIMEO_HASH = /^[a-f0-9]{6,32}$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Safe image `src`: http(s) URL or a same-origin absolute path. */
export function sanitizeImageSrc(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s || s.length > MAX_URL_LENGTH || /[\s<>"'\\]/.test(s)) return null;
  if (s.startsWith('/')) return s.startsWith('//') ? null : s;
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isValidVideoId(provider: VideoProvider, videoId: string): boolean {
  return provider === 'vimeo' ? VIMEO_ID.test(videoId) : YOUTUBE_ID.test(videoId);
}

export function isValidVimeoHash(hash: string): boolean {
  return VIMEO_HASH.test(hash);
}

export type ParsedVideo = { provider: VideoProvider; videoId: string; hash?: string };

/**
 * Parse a pasted Vimeo or YouTube URL. Returns null for anything else or for
 * providers outside `allowed`. Only well-known hosts are accepted.
 */
export function parseVideoUrl(
  raw: string,
  allowed: readonly VideoProvider[] = DEFAULT_VIDEO_PROVIDERS,
): ParsedVideo | null {
  const s = raw.trim();
  if (!s || s.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (allowed.includes('vimeo') && (host === 'vimeo.com' || host === 'player.vimeo.com')) {
    // vimeo.com/123, vimeo.com/123/abcdef, vimeo.com/channels/x/123,
    // player.vimeo.com/video/123?h=abcdef
    const idx = parts.findIndex((p) => VIMEO_ID.test(p));
    if (idx === -1) return null;
    const videoId = parts[idx]!;
    const h = url.searchParams.get('h') ?? parts[idx + 1];
    return { provider: 'vimeo', videoId, ...(h && VIMEO_HASH.test(h) ? { hash: h } : {}) };
  }

  if (allowed.includes('youtube')) {
    let id: string | null = null;
    if (host === 'youtu.be') id = parts[0] ?? null;
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (parts[0] === 'watch') id = url.searchParams.get('v');
      else if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') id = parts[1] ?? null;
    }
    if (id && YOUTUBE_ID.test(id)) return { provider: 'youtube', videoId: id };
  }
  return null;
}

/** Privacy-friendly embed URL (Vimeo `dnt=1`, YouTube nocookie). */
export function videoEmbedUrl(block: Pick<VideoBlock, 'provider' | 'videoId' | 'hash'>): string | null {
  if (!isValidVideoId(block.provider, block.videoId)) return null;
  if (block.provider === 'vimeo') {
    const h = block.hash && VIMEO_HASH.test(block.hash) ? `&h=${block.hash}` : '';
    return `https://player.vimeo.com/video/${block.videoId}?dnt=1${h}`;
  }
  return `https://www.youtube-nocookie.com/embed/${block.videoId}?rel=0`;
}

/** Link to the provider's own page (used where iframes are unavailable, e.g. native apps). */
export function videoWatchUrl(block: Pick<VideoBlock, 'provider' | 'videoId' | 'hash'>): string | null {
  if (!isValidVideoId(block.provider, block.videoId)) return null;
  if (block.provider === 'vimeo') {
    return block.hash && VIMEO_HASH.test(block.hash)
      ? `https://vimeo.com/${block.videoId}/${block.hash}`
      : `https://vimeo.com/${block.videoId}`;
  }
  return `https://www.youtube.com/watch?v=${block.videoId}`;
}

/** Attributes every renderer applies to video iframes. */
export const VIDEO_IFRAME_ATTRS = {
  allow: 'fullscreen; picture-in-picture; encrypted-media',
  referrerPolicy: 'strict-origin-when-cross-origin',
  sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
  loading: 'lazy',
} as const;

export function providerLabel(provider: VideoProvider): string {
  return provider === 'vimeo' ? 'Vimeo' : 'YouTube';
}
