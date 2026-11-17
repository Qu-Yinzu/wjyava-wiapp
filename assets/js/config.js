/**
 * config.js
 * Single place for API bases, TTLs, fixed coordinates, and defaults.
 * No secrets here: every endpoint is public and CORS-enabled.
 */

export const API_BASE = Object.freeze({
  geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
  forecast: 'https://api.open-meteo.com/v1/forecast'
});

/** Lokal CORS proxy for BMKG alert feeds (see server/README.md). */
const isLocalDev =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  window.location.port !== '3000';

export const PROXY_BASE = isLocalDev ? 'http://localhost:8787' : '';

export const BMKG = Object.freeze({
  alertsProxy: `${PROXY_BASE}/api/bmkg/alerts`,
  latestQuake: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json',
  recentQuakes: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json',
  alertsPage: 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca.bmkg',
  quakePage: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg',
  shakemapBase: 'https://data.bmkg.go.id/DataMKG/TEWS/'
});

export const GEO = Object.freeze({
  reverseGeocode: 'https://api.bigdatacloud.net/data/reverse-geocode-client',
  timeout: 10_000,
  maximumAge: 5 * 60 * 1000
});

export const WINDY = Object.freeze({
  embed: 'https://embed.windy.com/embed2.html',
  defaultZoom: 5,
  cityZoom: 8,
  layers: Object.freeze({
    wind: 'wind',
    rain: 'rain',
    temp: 'temp',
    clouds: 'clouds'
  })
});

/** Cache lifetimes in milliseconds. */
export const TTL = Object.freeze({
  geocoding: 24 * 60 * 60 * 1000,
  reverseGeocode: 24 * 60 * 60 * 1000,
  forecast: 10 * 60 * 1000,
  alerts: 5 * 60 * 1000,
  quakeLatest: 60 * 1000,
  quakeRecent: 5 * 60 * 1000,
  lastLocation: 30 * 24 * 60 * 60 * 1000
});

export const CACHE = Object.freeze({
  prefix: 'wjyava',
  version: 'v2',
  maxEntryBytes: 256 * 1024
});

export const HTTP = Object.freeze({
  timeout: 8000,
  retries: 2,
  backoff: Object.freeze([500, 1500])
});

export const SEARCH = Object.freeze({
  debounce: 300,
  minChars: 2,
  count: 10
});

export const DEFAULT_LOCATION = Object.freeze({
  id: 'default-jakarta',
  name: 'Jakarta',
  admin1: 'DKI Jakarta',
  country: 'Indonesia',
  countryCode: 'ID',
  lat: -6.2088,
  lon: 106.8456,
  timezone: 'Asia/Jakarta',
  source: 'default'
});

export const KOTA_BESAR = Object.freeze(
  [
    {
      id: 'jakarta',
      name: 'Jakarta',
      admin1: 'DKI Jakarta',
      country: 'Indonesia',
      countryCode: 'ID',
      lat: -6.2088,
      lon: 106.8456,
      timezone: 'Asia/Jakarta'
    },
    {
      id: 'surabaya',
      name: 'Surabaya',
      admin1: 'Jawa Timur',
      country: 'Indonesia',
      countryCode: 'ID',
      lat: -7.2575,
      lon: 112.7521,
      timezone: 'Asia/Jakarta'
    },
    {
      id: 'bandung',
      name: 'Bandung',
      admin1: 'Jawa Barat',
      country: 'Indonesia',
      countryCode: 'ID',
      lat: -6.9175,
      lon: 107.6191,
      timezone: 'Asia/Jakarta'
    },
    {
      id: 'medan',
      name: 'Medan',
      admin1: 'Sumatera Utara',
      country: 'Indonesia',
      countryCode: 'ID',
      lat: 3.5952,
      lon: 98.6722,
      timezone: 'Asia/Jakarta'
    },
    {
      id: 'makassar',
      name: 'Makassar',
      admin1: 'Sulawesi Selatan',
      country: 'Indonesia',
      countryCode: 'ID',
      lat: -5.1477,
      lon: 119.4327,
      timezone: 'Asia/Makassar'
    }
  ].map(Object.freeze)
);

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';
