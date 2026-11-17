/**
 * services/windy.service.js
 * Windy embed URL builder + layer metadata for the legend.
 * The iframe is the only consumer; no API key is required.
 */

import { DEFAULT_LOCATION, WINDY } from '../config.js';
import { t } from '../i18n/i18n.js';

export const OVERLAY_META = Object.freeze({
  wind: Object.freeze({
    id: 'wind',
    labelKey: 'map.layerWind',
    titleKey: 'map.legendWindTitle',
    minKey: 'map.legendWindMin',
    maxKey: 'map.legendWindMax',
    legend: 'linear-gradient(90deg, #1e3a8a, #0ea5e9, #a78bfa, #f5d76e)'
  }),
  rain: Object.freeze({
    id: 'rain',
    labelKey: 'map.layerRain',
    titleKey: 'map.legendRainTitle',
    minKey: 'map.legendRainMin',
    maxKey: 'map.legendRainMax',
    legend: 'linear-gradient(90deg, #0f172a, #1d4ed8, #0ea5e9, #22c55e)'
  }),
  temp: Object.freeze({
    id: 'temp',
    labelKey: 'map.layerTemp',
    titleKey: 'map.legendTempTitle',
    minKey: 'map.legendTempMin',
    maxKey: 'map.legendTempMax',
    legend: 'linear-gradient(90deg, #1e3a8a, #0ea5e9, #facc15, #ef4444)'
  }),
  clouds: Object.freeze({
    id: 'clouds',
    labelKey: 'map.layerClouds',
    titleKey: 'map.legendCloudsTitle',
    minKey: 'map.legendCloudsMin',
    maxKey: 'map.legendCloudsMax',
    legend: 'linear-gradient(90deg, #0f172a, #334155, #94a3b8, #e2e8f0)'
  })
});

/**
 * @param {string} overlay
 * @returns {'wind'|'rain'|'temp'|'clouds'}
 */
export function normaliseOverlay(overlay) {
  return Object.prototype.hasOwnProperty.call(OVERLAY_META, overlay) ? overlay : 'wind';
}

export function getOverlayMeta(overlay) {
  const meta = OVERLAY_META[normaliseOverlay(overlay)];
  return {
    ...meta,
    label: t(meta.labelKey),
    title: t(meta.titleKey),
    minLabel: t(meta.minKey),
    maxLabel: t(meta.maxKey)
  };
}

/**
 * Zoom 5 frames Indonesia; zoom 8 frames the selected city.
 * @param {{ source?: string }} [location]
 */
export function zoomForLocation(location) {
  if (!location) return WINDY.defaultZoom;
  return location.source === 'default' ? WINDY.defaultZoom : WINDY.cityZoom;
}

/**
 * @param {{ lat?: number, lon?: number, zoom?: number, overlay?: string }} [options]
 * @returns {string}
 */
export function buildEmbedUrl({ lat, lon, zoom, overlay } = {}) {
  const latitude = Number.isFinite(Number(lat)) ? Number(lat) : DEFAULT_LOCATION.lat;
  const longitude = Number.isFinite(Number(lon)) ? Number(lon) : DEFAULT_LOCATION.lon;
  const safeZoom = Number.isFinite(Number(zoom))
    ? Math.min(12, Math.max(3, Math.round(Number(zoom))))
    : WINDY.defaultZoom;

  const url = new URL(WINDY.embed);
  url.searchParams.set('lat', latitude.toFixed(4));
  url.searchParams.set('lon', longitude.toFixed(4));
  url.searchParams.set('detailLat', latitude.toFixed(4));
  url.searchParams.set('detailLon', longitude.toFixed(4));
  url.searchParams.set('zoom', String(safeZoom));
  url.searchParams.set('level', 'surface');
  url.searchParams.set('overlay', WINDY.layers[normaliseOverlay(overlay)] || 'wind');
  url.searchParams.set('product', 'ecmwf');
  url.searchParams.set('calendar', 'now');
  url.searchParams.set('type', 'map');
  url.searchParams.set('location', 'coordinates');
  url.searchParams.set('metricWind', 'km/h');
  url.searchParams.set('metricTemp', '°C');
  url.searchParams.set('radarRange', '-1');

  return url.toString();
}
