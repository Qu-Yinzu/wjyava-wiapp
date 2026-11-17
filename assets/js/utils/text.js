/**
 * utils/text.js
 * Small text helpers for comparing BMKG area names with the active location.
 * Nothing here rewrites official text: only comparison keys are normalised.
 */

const REGION_PREFIXES = [
  'provinsi',
  'propinsi',
  'kota administrasi',
  'kabupaten administrasi',
  'kota',
  'kabupaten',
  'kab.',
  'kecamatan',
  'kec.'
];

/** Lowercase, strip province/city prefixes, and collapse punctuation. */
export function normaliseRegion(value) {
  if (typeof value !== 'string') return '';

  let text = value
    .toLowerCase()
    .replace(/[.,;:/()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of REGION_PREFIXES) {
      if (text.startsWith(`${prefix} `)) {
        text = text.slice(prefix.length).trim();
        changed = true;
      }
    }
  }

  return text;
}

/** True when a BMKG area string clearly names the active province/region. */
export function regionMatches(area, admin1) {
  const target = normaliseRegion(admin1);
  const source = normaliseRegion(area);
  if (!target || !source) return false;

  return source === target || source.includes(target) || target.includes(source);
}

/** Collapse runs of whitespace without changing any words. */
export function collapseWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
