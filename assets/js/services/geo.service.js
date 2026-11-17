/**
 * services/geo.service.js
 * Browser Geolocation + BigDataCloud reverse geocoding.
 * Position errors are mapped to stable codes; the UI decides the copy.
 * Reverse-geocode results are cached for 24 hours per rounded coordinate.
 */

import { GEO, TTL } from '../config.js';
import { cacheGet, cacheSet } from '../core/cache.js';
import { buildUrl, fetchJson } from '../core/http.js';

export class GeoError extends Error {
  /**
   * @param {'unsupported'|'denied'|'unavailable'|'timeout'|'failed'|'reverse'} code
   * @param {string} [message]
   */
  constructor(code, message = '') {
    super(message || code);
    this.name = 'GeoError';
    this.code = code;
  }
}

export function canGeolocate() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

function codeFromPositionError(error) {
  switch (error?.code) {
    case 1:
      return 'denied';
    case 2:
      return 'unavailable';
    case 3:
      return 'timeout';
    default:
      return 'failed';
  }
}

/** Translate a GeoError code into an i18n key. */
export function geoMessageKey(code) {
  switch (code) {
    case 'unsupported':
      return 'toast.geoUnsupported';
    case 'denied':
      return 'toast.geoDenied';
    case 'unavailable':
      return 'toast.geoUnavailable';
    case 'timeout':
      return 'toast.geoTimeout';
    default:
      return 'toast.geoFailed';
  }
}

/**
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<{ lat: number, lon: number, accuracy: number }>}
 */
export function requestPosition({ timeout = GEO.timeout } = {}) {
  return new Promise((resolve, reject) => {
    if (!canGeolocate()) {
      reject(new GeoError('unsupported', 'Geolocation API tidak tersedia.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => reject(new GeoError(codeFromPositionError(error), error?.message)),
      {
        enableHighAccuracy: false,
        timeout,
        maximumAge: GEO.maximumAge
      }
    );
  });
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function admin1From(payload) {
  const direct = firstText(payload?.principalSubdivision, payload?.principalSubdivisionCode);
  if (direct) return direct;

  const entries = Array.isArray(payload?.localityInfo?.administrative)
    ? payload.localityInfo.administrative
    : [];

  const level4 = entries.find((entry) => Number(entry?.adminLevel) === 4);
  if (level4?.name) return String(level4.name);

  const order4 = entries.find((entry) => Number(entry?.order) === 4);
  return order4?.name ? String(order4.name) : '';
}

function normaliseReverse(payload, lat, lon) {
  const name = firstText(
    payload?.city,
    payload?.locality,
    payload?.principalSubdivision,
    payload?.countryName
  );

  return {
    id: `geo-${Number(lat).toFixed(4)}-${Number(lon).toFixed(4)}`,
    name: name || 'Lokasi',
    admin1: admin1From(payload),
    country: firstText(payload?.countryName),
    countryCode: firstText(payload?.countryCode).toUpperCase(),
    lat: Number(lat),
    lon: Number(lon),
    timezone: '',
    source: 'geo'
  };
}

/**
 * @param {{ lat: number, lon: number, lang?: 'id'|'en', force?: boolean }} input
 * @returns {Promise<{ location: object, fromCache: boolean, error: unknown }>}
 */
export async function reverseGeocode({ lat, lon, lang = 'id', force = false }) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    throw new GeoError('reverse', 'Koordinat tidak valid.');
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  const language = lang === 'en' ? 'en' : 'id';
  const key = `geo:${latitude.toFixed(3)},${longitude.toFixed(3)}:${language}`;

  if (!force) {
    const cached = cacheGet(key, { allowStale: false });
    if (cached?.data) {
      return { location: { ...cached.data, source: 'geo' }, fromCache: true, error: null };
    }
  }

  const url = buildUrl(GEO.reverseGeocode, {
    latitude,
    longitude,
    localityLanguage: language
  });

  try {
    const payload = await fetchJson(url, { timeout: 8000, retries: 1, backoff: [500] });
    const location = normaliseReverse(payload, latitude, longitude);
    cacheSet(key, location, TTL.reverseGeocode);
    return { location, fromCache: false, error: null };
  } catch (error) {
    const stale = cacheGet(key, { allowStale: true });
    if (stale?.data && Date.now() - stale.savedAt <= TTL.reverseGeocode) {
      return {
        location: { ...stale.data, source: 'geo' },
        fromCache: true,
        error
      };
    }

    throw new GeoError('reverse', error?.message || 'Reverse geocoding gagal.');
  }
}

/** Coordinate-only fallback when reverse geocoding is unavailable. */
export function coordinateLocation({ lat, lon }) {
  return {
    id: `geo-${Number(lat).toFixed(4)}-${Number(lon).toFixed(4)}`,
    name: 'Lokasi',
    admin1: '',
    country: '',
    countryCode: '',
    lat: Number(lat),
    lon: Number(lon),
    timezone: '',
    source: 'geo'
  };
}
