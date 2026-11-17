/**
 * main.js — Fase 4 entry point.
 * Boots i18n, the scoped UI modules, restores the shared-link or last location,
 * then loads the selected city forecast, the five-city summary, national BMKG
 * alerts, and the latest earthquake in parallel.
 */

import { DEFAULT_LOCATION, TTL } from './config.js';
import { cacheGet, cacheSet } from './core/cache.js';
import { issueRequestId, isLatestRequest, isAbortError } from './core/http.js';
import { initRouter } from './core/router.js';
import { store } from './core/store.js';
import { isValidLocation, readLocationFromUrl, syncLocationToUrl } from './core/url.js';
import { getForecast, getCitiesSummary, getCitySummary } from './services/forecast.service.js';
import { getAlerts, getLatestQuake } from './services/bmkg.service.js';
import { zoomForLocation } from './services/windy.service.js';
import { getLocale, initI18n, t } from './i18n/i18n.js';
import { captureSkeletons } from './ui/skeleton.js';
import { showToast } from './ui/feedback.js';
import { initNavbar } from './ui/navbar.js';
import { initSearch } from './ui/search.js';
import { initCurrentWeather } from './ui/current-weather.js';
import { initForecast } from './ui/forecast.js';
import { initCities } from './ui/cities.js';
import { initMap } from './ui/map.js';
import { initAlerts } from './ui/alerts.js';
import { initQuake } from './ui/quake.js';
import { initFaq } from './ui/faq.js';
import { initContact } from './ui/contact.js';

function readLastLocation() {
  const cached = cacheGet('last-location', { allowStale: false });
  if (cached && isValidLocation(cached.data)) {
    const saved = cached.data;
    return {
      ...saved,
      lat: Number(saved.lat),
      lon: Number(saved.lon),
      source: saved.source === 'default' ? 'default' : 'last'
    };
  }

  return { ...DEFAULT_LOCATION };
}

function updateDocumentTitle(name) {
  document.title = `${name} — WJYAVA Weather Intelligence`;
}

function normaliseLocation(location, fallbackSource = 'search') {
  return {
    id: location.id || `${Number(location.lat).toFixed(4)},${Number(location.lon).toFixed(4)}`,
    name: location.name || 'Lokasi',
    admin1: location.admin1 || '',
    country: location.country || '',
    countryCode: location.countryCode || '',
    lat: Number(location.lat),
    lon: Number(location.lon),
    timezone: location.timezone || '',
    source: location.source || fallbackSource
  };
}

function newestUpdatedAt(items) {
  let newest = 0;
  for (const item of items) {
    if (item?.status !== 'ok' || !item.data?.updatedAt) continue;
    const time = new Date(item.data.updatedAt).getTime();
    if (Number.isFinite(time) && time > newest) newest = time;
  }
  return newest ? new Date(newest).toISOString() : null;
}

async function loadWeather(location, { force = false } = {}) {
  const requestId = issueRequestId('weather');
  store.set('weather', { status: 'loading', data: null, updatedAt: null, error: null });

  try {
    const data = await getForecast(location, { force });
    if (!isLatestRequest('weather', requestId)) return;

    store.set('weather', {
      status: 'ready',
      data: { ...data, location: { ...data.location, source: location.source } },
      updatedAt: data.updatedAt,
      error: null
    });
  } catch (error) {
    if (isAbortError(error) || !isLatestRequest('weather', requestId)) return;

    store.set('weather', { status: 'error', data: null, updatedAt: null, error });
    showToast(t('toast.weatherFailed', { city: location.name }), { tone: 'warn' });
  }
}

async function loadCities({ force = false } = {}) {
  const requestId = issueRequestId('cities');
  store.set('cities', { status: 'loading', data: [], updatedAt: null, error: null });

  try {
    const summary = await getCitiesSummary({ force });
    if (!isLatestRequest('cities', requestId)) return;

    store.set('cities', {
      status: 'ready',
      data: summary.items,
      updatedAt: summary.updatedAt,
      error: null
    });

    if (summary.allFailed) {
      showToast(t('toast.citiesAllFailed'), { tone: 'warn' });
    }
  } catch (error) {
    if (!isLatestRequest('cities', requestId)) return;

    store.set('cities', { status: 'error', data: [], updatedAt: null, error });
    showToast(t('toast.citiesFailed'), { tone: 'warn' });
  }
}

async function loadAlerts(lang = getLocale(), { force = false } = {}) {
  const requestId = issueRequestId('alerts');
  store.set('alerts', { status: 'loading', error: null });

  try {
    const result = await getAlerts(lang, { force });
    if (!isLatestRequest('alerts', requestId)) return;

    if (result.status === 'degraded') {
      store.set('alerts', {
        status: 'degraded',
        data: result.data,
        error: result.error,
        scope: 'national'
      });
      return;
    }

    store.set('alerts', {
      status: 'ready',
      data: result.data,
      error: null,
      scope: 'national'
    });
  } catch (error) {
    if (!isLatestRequest('alerts', requestId)) return;
    store.set('alerts', {
      status: 'error',
      data: { items: [], updatedAt: null, stale: false, degraded: true },
      error,
      scope: 'national'
    });
  }
}

async function loadQuake({ force = false } = {}) {
  const requestId = issueRequestId('quake');
  store.set('quake', { status: 'loading', data: null, error: null });

  try {
    const data = await getLatestQuake({ force });
    if (!isLatestRequest('quake', requestId)) return;
    store.set('quake', { status: 'ready', data, error: null });
  } catch (error) {
    if (!isLatestRequest('quake', requestId)) return;
    store.set('quake', { status: 'error', data: null, error });
  }
}

async function retryCity(city) {
  const before = store.select('cities');
  const items = Array.isArray(before.data) ? before.data : [];
  const targetIndex = items.findIndex((item) => item.city?.id === city.id);
  if (targetIndex < 0) return;

  store.set('cities', {
    data: items.map((item, index) =>
      index === targetIndex ? { ...item, status: 'loading', error: null } : item
    )
  });

  try {
    const data = await getCitySummary(city);
    const latest = store.select('cities');
    const currentItems = Array.isArray(latest.data) ? latest.data : [];
    const index = currentItems.findIndex((item) => item.city?.id === city.id);
    if (index < 0) return;

    const nextItems = currentItems.map((item, position) =>
      position === index ? { city, status: 'ok', data, error: null } : item
    );

    store.set('cities', {
      status: 'ready',
      data: nextItems,
      updatedAt: newestUpdatedAt(nextItems),
      error: null
    });
  } catch (error) {
    const latest = store.select('cities');
    const currentItems = Array.isArray(latest.data) ? latest.data : [];
    const index = currentItems.findIndex((item) => item.city?.id === city.id);
    if (index < 0) return;

    store.set('cities', {
      data: currentItems.map((item, position) =>
        position === index ? { ...item, status: 'error', data: null, error } : item
      )
    });

    showToast(t('toast.cityRetryFailed', { city: city.name }), { tone: 'warn' });
  }
}

function retryWeather() {
  loadWeather(store.select('location'), { force: true });
}

function selectLocation(location) {
  if (!isValidLocation(location)) return;

  const next = normaliseLocation(location);
  store.set('location', next);
  store.set('map', { zoom: zoomForLocation(next) });

  cacheSet('last-location', next, TTL.lastLocation);
  syncLocationToUrl(next);
  updateDocumentTitle(next.name);

  loadWeather(next);
}

function selectCityFromCard(city) {
  selectLocation({ ...city, source: 'quick' });
}

function applyBootLocation(location) {
  const next = normaliseLocation(location, 'default');

  store.set('location', next);
  store.set('map', { zoom: zoomForLocation(next) });
  updateDocumentTitle(next.name);

  cacheSet('last-location', next, TTL.lastLocation);
  loadWeather(next);
}

function bindConnectivity() {
  window.addEventListener('offline', () => {
    store.set('meta', { online: false });
    showToast(t('toast.offline'), { tone: 'warn' });
  });

  window.addEventListener('online', () => {
    store.set('meta', { online: true });
    showToast(t('toast.online'));
  });
}

function boot() {
  try {
    const locale = initI18n();
    store.set('meta', { locale }, { silent: true });

    captureSkeletons();

    initNavbar({
      onLocaleChange: (nextLocale) => {
        loadAlerts(nextLocale, { force: true });
      },
      onGeolocate: (location) => {
        selectLocation(location);
      }
    });
    initContact();
    initSearch({ onSelect: selectLocation });
    initCurrentWeather({ onRetry: retryWeather });
    initForecast({ onRetry: retryWeather });
    initCities({
      onRetryCity: retryCity,
      onRetryAll: () => loadCities({ force: true }),
      onSelectCity: selectCityFromCard
    });
    initAlerts({ onRetry: () => loadAlerts(getLocale(), { force: true }) });
    initQuake({ onRetry: () => loadQuake({ force: true }) });
    initMap();
    initFaq();
    initRouter();
    bindConnectivity();

    // A shared link outranks the browser's last location; the URL is only
    // rewritten when the visitor picks a new city.
    applyBootLocation(readLocationFromUrl() || readLastLocation());
    loadCities();
    loadAlerts(locale);
    loadQuake();
  } catch (error) {
    console.error('[WJYAVA] Boot failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[WJYAVA] Unhandled promise rejection:', event.reason);
});
