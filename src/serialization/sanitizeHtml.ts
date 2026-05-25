// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _domPurify: { sanitize: (dirty: string, config?: Record<string, unknown>) => string } | null = null;

function getDomPurify(): { sanitize: (dirty: string, config?: Record<string, unknown>) => string } | null {
  if (_domPurify) return _domPurify;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dp = (window as any).DOMPurify;
      if (dp?.sanitize) {
        _domPurify = dp;
        return _domPurify;
      }
    } catch {
      // fall through
    }
  }
  return null;
}

const ALLOWED_TAGS = [
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'caption',
  'cite', 'code', 'col', 'colgroup', 'details', 'div', 'em', 'figcaption',
  'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
  'i', 'img', 'input', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q',
  's', 'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul',
];

const ALLOWED_ATTRS = [
  'alt', 'aria-hidden', 'aria-label', 'aria-labelledby', 'checked',
  'class', 'data-asset-id', 'data-background', 'data-type', 'data-url',
  'disabled', 'height', 'href', 'id', 'loading', 'open', 'rel', 'src',
  'start', 'style', 'target', 'title', 'type', 'width',
];

export function sanitizeHtml(dirty: string): string {
  const purify = getDomPurify();
  if (purify) {
    return purify.sanitize(dirty, {
        ALLOWED_TAGS,
        ALLOWED_ATTR: ALLOWED_ATTRS,
        FORBID_SCRIPTS: true,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
        FORCE_BODY: false,
    });
  }

  // Server-side: strip script/on* attributes with regex (DOMPurify is browser-only)
  return dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, '')
    .replace(/<iframe(?:[^>]*?)>/gi, '')
    .replace(/<\/iframe>/gi, '');
}
