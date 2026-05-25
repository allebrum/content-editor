/**
 * Generates a short, URL-safe unique ID.
 * Uses crypto.randomUUID when available, otherwise falls back to Math.random.
 */
export function generateId(prefix = ''): string {
  const base =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${base}` : base;
}
