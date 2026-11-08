/**
 * URL and text safety helpers. The editor stores plain text only (no raw HTML).
 * These checks exist so hosts and the HTML renderer never emit script URLs.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns a safe href or null. Rejects javascript:, data:, vbscript:,
 * protocol-relative URLs, and other non-allowlisted schemes.
 */
export function sanitizeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed || /[\s<>"]/.test(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
      return url.href;
    } catch {
      return null;
    }
  }
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return trimmed;
  }
  return null;
}

export function isSafeHref(raw: string | null | undefined): boolean {
  return sanitizeHref(raw) !== null;
}
