/**
 * services/bmkg.service.js
 * BMKG client facade:
 *  - alerts via the local CORS proxy (5-minute client cache, non-throwing
 *    degraded result with the official link)
 *  - latest earthquake directly from data.bmkg.go.id (60-second cache) with
 *    the recent-earthquakes list as fallback (5-minute cache)
 *
 * Official BMKG strings are kept verbatim; this file only normalises shapes.
 */

import { BMKG, TTL } from '../config.js';
import { cacheGet, cacheSet } from '../core/cache.js';
import { fetchJson } from '../core/http.js';

const ALERT_CACHE_PREFIX = 'bmkg-alerts:';
const QUAKE_LATEST_KEY = 'bmkg-quake:latest';
const QUAKE_RECENT_KEY = 'bmkg-quake:recent';

function alertsUrl(lang) {
  const url = new URL(BMKG.alertsProxy);
  url.searchParams.set('lang', lang);
  return url.toString();
}

function sourceUrlFor(lang) {
  return `https://www.bmkg.go.id/alerts/nowcast/${lang}/rss.xml`;
}

export function emptyAlertsPayload(lang = 'id', { degraded = true } = {}) {
  return {
    source: 'BMKG',
    scope: 'national',
    language: lang,
    sourceUrl: sourceUrlFor(lang),
    updatedAt: null,
    fetchedAt: new Date().toISOString(),
    stale: false,
    items: [],
    degraded
  };
}

function normaliseAlertItem(item) {
  return {
    id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
    headline: typeof item.headline === 'string' ? item.headline : null,
    event: typeof item.event === 'string' ? item.event : null,
    severity: typeof item.severity === 'string' ? item.severity : null,
    level: typeof item.level === 'string' ? item.level : 'unknown',
    certainty: typeof item.certainty === 'string' ? item.certainty : null,
    urgency: typeof item.urgency === 'string' ? item.urgency : null,
    area: typeof item.area === 'string' ? item.area : null,
    onset: typeof item.onset === 'string' ? item.onset : null,
    expires: typeof item.expires === 'string' ? item.expires : null,
    publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : null,
    description: typeof item.description === 'string' ? item.description : null,
    senderName: typeof item.senderName === 'string' ? item.senderName : null,
    status: typeof item.status === 'string' ? item.status : null,
    url: typeof item.url === 'string' ? item.url : null,
    detailStatus: item.detailStatus === 'ok' ? 'ok' : 'unavailable'
  };
}

function validateAlertsPayload(payload, lang) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) {
    throw new Error('Proxy BMKG mengembalikan bentuk data yang tidak dikenal.');
  }

  return {
    source: 'BMKG',
    scope: 'national',
    language: payload.language === 'en' ? 'en' : lang,
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : sourceUrlFor(lang),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : null,
    fetchedAt: typeof payload.fetchedAt === 'string' ? payload.fetchedAt : new Date().toISOString(),
    stale: payload.stale === true,
    degraded: payload.degraded === true,
    items: payload.items.map(normaliseAlertItem)
  };
}

/**
 * @param {'id'|'en'} lang
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{
 *   status: 'ok'|'stale'|'degraded',
 *   data: object,
 *   error: unknown,
 *   cachedAt: number|null,
 *   officialUrl: string
 * }>} never throws
 */
export async function getAlerts(lang = 'id', { force = false } = {}) {
  const language = lang === 'en' ? 'en' : 'id';
  const key = `${ALERT_CACHE_PREFIX}${language}`;
  const base = { error: null, cachedAt: null, officialUrl: BMKG.alertsPage };

  if (!force) {
    const cached = cacheGet(key, { allowStale: false });
    if (cached?.data) {
      return { ...base, status: 'ok', data: cached.data, cachedAt: cached.savedAt };
    }
  }

  try {
    const payload = validateAlertsPayload(
      await fetchJson(alertsUrl(language), { timeout: 8000, retries: 1, backoff: [500] }),
      language
    );
    cacheSet(key, payload, TTL.alerts);
    return { ...base, status: 'ok', data: payload };
  } catch (error) {
    // Stale client cache is only useful for the same 5-minute window documented
    // in the API contract; older values become an honest degraded state.
    const stale = cacheGet(key, { allowStale: true });
    const freshEnough = stale?.data && Date.now() - stale.savedAt <= TTL.alerts;

    if (freshEnough) {
      return {
        ...base,
        status: 'stale',
        data: { ...stale.data, stale: true },
        error,
        cachedAt: stale.savedAt
      };
    }

    return {
      ...base,
      status: 'degraded',
      data: emptyAlertsPayload(language),
      error
    };
  }
}

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function isoOrNull(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normaliseQuake(gempa, via) {
  if (!gempa || typeof gempa !== 'object') {
    throw new Error('Data gempa BMKG tidak memiliki objek gempa.');
  }

  const magnitudeRaw = text(gempa.Magnitude);
  const region = text(gempa.Wilayah);
  if (!magnitudeRaw || !region) {
    throw new Error('Data gempa BMKG tidak lengkap.');
  }

  const magnitude = Number(magnitudeRaw.replace(',', '.'));
  const dateTime = isoOrNull(gempa.DateTime);
  const shakemap = text(gempa.Shakemap);

  return {
    source: 'BMKG',
    scope: 'national',
    via,
    magnitude: Number.isFinite(magnitude) ? magnitude : null,
    magnitudeText: magnitudeRaw,
    depth: text(gempa.Kedalaman) || null,
    region,
    dateText: text(gempa.Tanggal) || null,
    timeText: text(gempa.Jam) || null,
    dateTime,
    coordinates: text(gempa.Coordinates) || null,
    latitude: text(gempa.Lintang) || null,
    longitude: text(gempa.Bujur) || null,
    potential: text(gempa.Potensi) || null,
    felt: text(gempa.Dirasakan) || null,
    shakemapUrl: shakemap ? `${BMKG.shakemapBase}${shakemap}` : null,
    url: BMKG.quakePage,
    updatedAt: dateTime || new Date().toISOString(),
    stale: false
  };
}

function firstRecentGempa(payload) {
  const list = payload?.Infogempa?.gempa;
  if (Array.isArray(list)) return list[0] || null;
  return list || null;
}

/**
 * Latest earthquake, direct from BMKG.
 * @param {{ force?: boolean }} [options]
 */
export async function getLatestQuake({ force = false } = {}) {
  if (!force) {
    const cached = cacheGet(QUAKE_LATEST_KEY, { allowStale: false });
    if (cached?.data) return { ...cached.data, stale: false };
  }

  try {
    const gempa = await fetchJson(BMKG.latestQuake, { timeout: 8000, retries: 1, backoff: [500] });
    const data = normaliseQuake(gempa?.Infogempa?.gempa, 'autogempa');
    cacheSet(QUAKE_LATEST_KEY, data, TTL.quakeLatest);
    return data;
  } catch (latestError) {
    try {
      let recent = !force ? cacheGet(QUAKE_RECENT_KEY, { allowStale: false }) : null;
      let fromCache = Boolean(recent?.data);

      if (!recent?.data) {
        const payload = await fetchJson(BMKG.recentQuakes, { timeout: 8000, retries: 1, backoff: [500] });
        const data = normaliseQuake(firstRecentGempa(payload), 'gempaterkini');
        cacheSet(QUAKE_RECENT_KEY, data, TTL.quakeRecent);
        recent = { data, savedAt: Date.now() };
        fromCache = false;
      }

      return { ...recent.data, stale: false, fallback: true, fromCache };
    } catch {
      const stale = cacheGet(QUAKE_LATEST_KEY, { allowStale: true });
      if (stale?.data) {
        return { ...stale.data, stale: true, cachedAt: stale.savedAt };
      }
      throw latestError;
    }
  }
}

/** Build the official BMKG shakemap/quake page URL for attribution links. */
export function quakeSourceUrl() {
  return BMKG.quakePage;
}
