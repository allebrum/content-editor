import { describe, expect, it } from 'vitest';
import { escapeHtml, isSafeHref, sanitizeHref } from '../sanitize';

describe('sanitizeHref', () => {
  it('allows http(s), mailto, tel, and relative paths', () => {
    expect(sanitizeHref('https://example.com/a') ).toBe('https://example.com/a');
    expect(sanitizeHref('http://example.com')).toMatch(/^http:\/\//);
    expect(sanitizeHref('mailto:hi@example.com')).toMatch(/^mailto:/);
    expect(sanitizeHref('/docs/page')).toBe('/docs/page');
    expect(sanitizeHref('#section')).toBe('#section');
    expect(isSafeHref('https://ok.test')).toBe(true);
  });

  it('rejects javascript, data, vbscript, and protocol-relative URLs', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeNull();
    expect(sanitizeHref('JAVASCRIPT:alert(1)')).toBeNull();
    expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeHref('vbscript:msgbox(1)')).toBeNull();
    expect(sanitizeHref('//evil.example/path')).toBeNull();
    expect(sanitizeHref('file:///etc/passwd')).toBeNull();
    expect(isSafeHref('javascript:void(0)')).toBe(false);
  });
});

describe('escapeHtml', () => {
  it('escapes markup so renderers never emit raw HTML', () => {
    expect(escapeHtml('<script src="x">alert("y")</script>')).toBe(
      '&lt;script src=&quot;x&quot;&gt;alert(&quot;y&quot;)&lt;/script&gt;',
    );
  });
});
