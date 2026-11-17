/**
 * services/forecast.service.js
 * Open-Meteo forecast (E3) with 10-minute cache and stale fallback.
 * Normalised shape is the only thing the UI depends on.
 */

import { API_BASE, DEFAULT_TIMEZONE, KOTA_BESAR, TTL } from '../config.js';
import { buildUrl, fetchJson } from '../core/http.js';
import { cacheGet, cacheSet } from '../core/cache.js';
import { parseLocalIso } from '../utils/format.js';

const CACHE_PREFIX = 'forecast:';

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'uv_index'
].join(',');

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'uv_index_max',
  'sunrise',
  'sunset'
].join(',');

function toNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cacheKey(location) {
  return `${CACHE_PREFIX}${Number(location.lat).toFixed(4)},${Number(location.lon).toFixed(4)}`;
}

function normaliseLocation(location) {
  return {
    id: location.id || `${Number(location.lat).toFixed(4)},${Number(location.lon).toFixed(4)}`,
    name: location.name || 'Lokasi',
    admin1: location.admin1 || '',
    country: location.country || '',
    countryCode: location.countryCode || '',
    lat: Number(location.lat),
    lon: Number(location.lon),
    timezone: location.timezone || '',
    source: location.source || 'search'
  };
}

function normaliseDaily(daily) {
  const dates = Array.isArray(daily?.time) ? daily.time : [];

  return dates.slice(0, 5).map((date, index) => ({
    date,
    weatherCode: toNumber(daily.weather_code?.[index]),
    tempMax: toNumber(daily.temperature_2m_max?.[index]),
    tempMin: toNumber(daily.temperature_2m_min?.[index]),
    rainProbability: toNumber(daily.precipitation_probability_max?.[index]),
    uvIndexMax: toNumber(daily.uv_index_max?.[index]),
    sunrise: typeof daily.sunrise?.[index] === 'string' ? daily.sunrise[index] : null,
    sunset: typeof daily.sunset?.[index] === 'string' ? daily.sunset[index] : null
  }));
}

function normaliseForecast(payload, location) {
  const current = payload?.current || {};
  const timezone = payload?.timezone || location.timezone || DEFAULT_TIMEZONE;
  const utcOffsetSeconds = toNumber(payload?.utc_offset_seconds) || 0;
  const instant = parseLocalIso(current.time, utcOffsetSeconds);

  return {
    location: { ...location, timezone },
    timezone,
    utcOffsetSeconds,
    elevation: toNumber(payload?.elevation),
    current: {
      time: typeof current.time === 'string' ? current.time : null,
      instant,
      temperature: toNumber(current.temperature_2m),
      apparentTemperature: toNumber(current.apparent_temperature),
      humidity: toNumber(current.relative_humidity_2m),
      isDay: current.is_day === 0 ? 0 : 1,
      precipitation: toNumber(current.precipitation),
      weatherCode: toNumber(current.weather_code) ?? -1,
      cloudCover: toNumber(current.cloud_cover),
      windSpeed: toNumber(current.wind_speed_10m),
      windDirection: toNumber(current.wind_direction_10m),
      uvIndex: toNumber(current.uv_index)
    },
    daily: normaliseDaily(payload?.daily),
    source: 'Open-Meteo',
    updatedAt: instant || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    stale: false
  };
}

/**
 * @param {object} location normalised location (lat/lon required)
 * @param {{ signal?: AbortSignal, force?: boolean }} [options]
 */
export async function getForecast(location, { signal, force = false } = {}) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lon))) {
    throw new Error('Koordinat lokasi tidak valid.');
  }

  const target = normaliseLocation(location);
  const key = cacheKey(target);

  if (!force) {
    const cached = cacheGet(key, { allowStale: false });
    if (cached && cached.data) return { ...cached.data, stale: false };
  }

  const url = buildUrl(API_BASE.forecast, {
    latitude: target.lat,
    longitude: target.lon,
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    timezone: 'auto',
    forecast_days: 5,
    wind_speed_unit: 'kmh'
  });

  try {
    const payload = await fetchJson(url, { signal });
    const data = normaliseForecast(payload, target);
    cacheSet(key, data, TTL.forecast);
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;

    // Degraded mode: serve the last stored value for this coordinate.
    const stale = cacheGet(key, { allowStale: true });
    if (stale && stale.data) {
      return { ...stale.data, stale: true, cachedAt: stale.savedAt };
    }

    throw error;
  }
}

function newestTimestamp(items) {
  let newest = 0;
  for (const item of items) {
    const iso = item?.data?.updatedAt;
    const time = iso ? new Date(iso).getTime() : 0;
    if (Number.isFinite(time) && time > newest) newest = time;
  }
  return newest ? new Date(newest).toISOString() : null;
}

/**
 * Five fixed cities, settled independently so one failure cannot blank the grid.
 * @param {{ force?: boolean, signal?: AbortSignal }} [options]
 */
export async function getCitiesSummary({ force = false, signal } = {}) {
  const settled = await Promise.allSettled(
    KOTA_BESAR.map((city) => getForecast(city, { force, signal }))
  );

  const items = settled.map((result, index) => {
    const city = KOTA_BESAR[index];

    if (result.status === 'fulfilled') {
      return { city, status: 'ok', data: result.value, error: null };
    }

    return { city, status: 'error', data: null, error: result.reason };
  });

  return {
    items,
    updatedAt: newestTimestamp(items),
    stale: items.some((item) => item.status === 'ok' && item.data?.stale),
    allFailed: items.every((item) => item.status === 'error')
  };
}

/**
 * Retry helper used by a single city card.
 * @param {object} city
 */
export function getCitySummary(city) {
  return getForecast(city, { force: true });
}
