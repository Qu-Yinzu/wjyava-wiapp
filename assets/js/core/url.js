/**
 * core/url.js
 * Shareable location links without history spam.
 *
 * A selected location is mirrored to the current URL with `history.replaceState`
 * so the address bar can be copied and reopened. Coordinates travel with the
 * slug, which keeps non-seeded cities shareable while `?city=bandung` alone can
 * still resolve to one of the five seeded cities.
 */

import { KOTA_BESAR } from '../config.js';

export const LOCATION_PARAMS = Object.freeze([
  'city',
  'lat',
  'lon',
  'admin1',
  'country',
  'cc',
  'tz'
]);

const PARAM_SET = new Set(LOCATION_PARAMS);

/** Lowercase, accent-free, hyphenated slug used for matching and links. */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(value, max = 120) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function coordinate(value, min, max) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function seededCity(name) {
  const slug = slugify(name);
  if (!slug) return null;

  return (
    KOTA_BESAR.find((city) => city.id === slug || slugify(city.name) === slug) || null
  );
}

export function isValidLocation(location) {
  return Boolean(
    location &&
      cleanText(location.name) &&
      Number.isFinite(Number(location.lat)) &&
      Number.isFinite(Number(location.lon)) &&
      Number(location.lat) >= -90 &&
      Number(location.lat) <= 90 &&
      Number(location.lon) >= -180 &&
      Number(location.lon) <= 180
  );
}

/**
 * Read a location from a query string. Coordinates win because they describe the
 * exact place; a seeded slug is the fallback for hand-written short links.
 *
 * @param {string | URLSearchParams} [search]
 * @returns {object | null}
 */
export function readLocationFromUrl(search = window.location.search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const name = cleanText(params.get('city'));
  if (!name) return null;

  const lat = coordinate(params.get('lat'), -90, 90);
  const lon = coordinate(params.get('lon'), -180, 180);

  if (lat !== null && lon !== null) {
    const countryCode = cleanText(params.get('cc'), 2).toUpperCase();

    return {
      id: `${lat.toFixed(4)},${lon.toFixed(4)}`,
      name,
      admin1: cleanText(params.get('admin1')),
      country: cleanText(params.get('country')),
      countryCode: /^[A-Z]{2}$/.test(countryCode) ? countryCode : '',
      lat,
      lon,
      timezone: cleanText(params.get('tz'), 64),
      source: 'url'
    };
  }

  const seeded = seededCity(name);
  if (!seeded) return null;

  return { ...seeded, source: 'url' };
}

/**
 * Mirror a location into the address bar in place.
 * Unrelated query parameters (campaign tags, debug flags) are preserved.
 *
 * @param {object} location
 * @param {{ history?: History, location?: Location }} [targets]
 * @returns {string | null} the written URL, or null when nothing was written
 */
export function syncLocationToUrl(
  location,
  { history = window.history, location: current = window.location } = {}
) {
  if (!isValidLocation(location) || !history?.replaceState) return null;

  try {
    const url = new URL(current.href);

    for (const key of PARAM_SET) url.searchParams.delete(key);

    url.searchParams.set('city', cleanText(location.name));
    url.searchParams.set('lat', Number(location.lat).toFixed(4));
    url.searchParams.set('lon', Number(location.lon).toFixed(4));

    const optional = {
      admin1: cleanText(location.admin1),
      country: cleanText(location.country),
      cc: cleanText(location.countryCode, 2).toUpperCase(),
      tz: cleanText(location.timezone, 64)
    };

    for (const [key, value] of Object.entries(optional)) {
      if (value) url.searchParams.set(key, value);
    }

    history.replaceState(history.state, '', url);
    return url.toString();
  } catch {
    // replaceState can fail on file:// origins or when the document is sandboxed.
    return null;
  }
}
