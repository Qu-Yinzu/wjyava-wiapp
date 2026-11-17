/**
 * services/geocoding.service.js
 * Open-Meteo geocoding (E1) with:
 *  - Indonesian results first, then by population
 *  - duplicate collapse on rounded coordinates
 *  - 24 h cache per normalised query
 *  - static fuzzy suggestions from KOTA_BESAR
 */

import { API_BASE, KOTA_BESAR, SEARCH, TTL } from '../config.js';
import { buildUrl, fetchJson } from '../core/http.js';
import { cacheGet, cacheSet } from '../core/cache.js';

const CACHE_PREFIX = 'geo:';

function normaliseQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normaliseResult(item) {
  const lat = toNumber(item.latitude);
  const lon = toNumber(item.longitude);
  if (lat === null || lon === null) return null;

  const name = typeof item.name === 'string' ? item.name : '';
  if (!name) return null;

  return {
    id: item.id !== undefined && item.id !== null ? `geo-${item.id}` : `geo-${lat.toFixed(4)},${lon.toFixed(4)}`,
    name,
    admin1: typeof item.admin1 === 'string' ? item.admin1 : '',
    admin2: typeof item.admin2 === 'string' ? item.admin2 : '',
    country: typeof item.country === 'string' ? item.country : '',
    countryCode: typeof item.country_code === 'string' ? item.country_code.toUpperCase() : '',
    lat,
    lon,
    timezone: typeof item.timezone === 'string' ? item.timezone : '',
    population: toNumber(item.population) || 0,
    source: 'search'
  };
}

function dedupe(items) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    if (!item) continue;
    const key = `${item.name.toLowerCase()}|${item.lat.toFixed(3)}|${item.lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function sortResults(items) {
  return [...items].sort((a, b) => {
    const aId = a.countryCode === 'ID' ? 1 : 0;
    const bId = b.countryCode === 'ID' ? 1 : 0;
    if (aId !== bId) return bId - aId;
    return b.population - a.population;
  });
}

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal, force?: boolean }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function searchCities(query, { signal, force = false } = {}) {
  const trimmed = (query || '').trim();
  if (trimmed.length < SEARCH.minChars) return [];

  const key = `${CACHE_PREFIX}${normaliseQuery(trimmed)}:${SEARCH.count}`;

  if (!force) {
    const cached = cacheGet(key, { allowStale: false });
    if (cached && Array.isArray(cached.data)) return cached.data;
  }

  const url = buildUrl(API_BASE.geocoding, {
    name: trimmed,
    count: SEARCH.count,
    language: 'id',
    format: 'json'
  });

  const payload = await fetchJson(url, { signal });
  const rawResults = Array.isArray(payload?.results) ? payload.results : [];
  const results = sortResults(dedupe(rawResults.map(normaliseResult)));

  cacheSet(key, results, TTL.geocoding);
  return results;
}

/**
 * Static fuzzy suggestions used when the search returns nothing.
 * Never includes the active city (caller passes excludeIds).
 * @param {string} query
 * @param {{ limit?: number, excludeIds?: string[] }} [options]
 */
export function suggestCities(query, { limit = 3, excludeIds = [] } = {}) {
  const needle = (query || '').trim().toLowerCase();
  const excluded = new Set(excludeIds);

  const pool = KOTA_BESAR.map((city) => ({ ...city, source: 'quick' }));
  const available = pool.filter((city) => !excluded.has(city.id));

  const scored = available
    .map((city) => {
      const name = city.name.toLowerCase();
      const admin = (city.admin1 || '').toLowerCase();
      let score = 0;

      if (name.startsWith(needle)) score = 3;
      else if (name.includes(needle)) score = 2;
      else if (admin.includes(needle)) score = 1;

      return { city, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, 'id'));

  if (scored.length) return scored.slice(0, limit).map((entry) => entry.city);
  return available.slice(0, limit);
}

/**
 * Exact static lookup used by the popular-city chips.
 * @param {string} name
 */
export function findStaticCity(name) {
  const needle = (name || '').trim().toLowerCase();
  if (!needle) return null;

  const city = KOTA_BESAR.find((entry) => entry.name.toLowerCase() === needle);
  return city ? { ...city, source: 'quick' } : null;
}
