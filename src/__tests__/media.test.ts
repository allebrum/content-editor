import { describe, expect, it } from 'vitest';
import { parseVideoUrl, sanitizeImageSrc, videoEmbedUrl, videoWatchUrl } from '../media';

describe('parseVideoUrl', () => {
  it('accepts Vimeo URLs, including unlisted hashes', () => {
    expect(parseVideoUrl('https://vimeo.com/76979871')).toEqual({ provider: 'vimeo', videoId: '76979871' });
    expect(parseVideoUrl('vimeo.com/76979871/abc123def0')).toEqual({ provider: 'vimeo', videoId: '76979871', hash: 'abc123def0' });
    expect(parseVideoUrl('https://player.vimeo.com/video/76979871?h=abc123&badge=0')).toEqual({ provider: 'vimeo', videoId: '76979871', hash: 'abc123' });
    expect(parseVideoUrl('https://vimeo.com/channels/staffpicks/76979871')?.videoId).toBe('76979871');
  });

  it('rejects YouTube unless allowed, and accepts common YouTube forms when it is', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    const yt = ['vimeo', 'youtube'] as const;
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(parseVideoUrl(u, yt)).toEqual({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
    }
  });

  it('rejects look-alike hosts, other schemes, and junk', () => {
    expect(parseVideoUrl('https://vimeo.com.evil.example/123')).toBeNull();
    expect(parseVideoUrl('https://evilvimeo.com/123')).toBeNull();
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull();
    expect(parseVideoUrl('https://vimeo.com/about')).toBeNull();
    expect(parseVideoUrl('')).toBeNull();
  });
});

describe('embed URLs', () => {
  it('builds privacy-friendly embed and watch URLs from ids only', () => {
    expect(videoEmbedUrl({ provider: 'vimeo', videoId: '123', hash: 'abcdef' })).toBe('https://player.vimeo.com/video/123?dnt=1&h=abcdef');
    expect(videoEmbedUrl({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' })).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
    expect(videoEmbedUrl({ provider: 'vimeo', videoId: '1"><script>' })).toBeNull();
    expect(videoWatchUrl({ provider: 'vimeo', videoId: '123', hash: 'abcdef' })).toBe('https://vimeo.com/123/abcdef');
  });
});

describe('sanitizeImageSrc', () => {
  it('allows http(s) and same-origin paths only', () => {
    expect(sanitizeImageSrc('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
    expect(sanitizeImageSrc('/img/abc?w=800')).toBe('/img/abc?w=800');
    for (const bad of ['javascript:alert(1)', 'data:image/png;base64,AAA', '//evil/x.png', 'x.png', 'https://u:p@h/x', 'https://h/x y', '']) {
      expect(sanitizeImageSrc(bad)).toBeNull();
    }
  });
});
