/**
 * core/store.js
 * Tiny global state container with per-slice pub/sub.
 *
 * UI modules subscribe to the slice they render. A weather update therefore
 * never notifies the map module, so the Windy iframe is not rebuilt.
 */

import { DEFAULT_LOCATION, WINDY } from '../config.js';

const initialState = {
  meta: { locale: 'id', theme: 'dark', unit: 'metric', online: true, hydratedFromCache: false },
  location: { ...DEFAULT_LOCATION },
  search: { query: '', status: 'idle', results: [], suggestions: [], error: null, open: false },
  weather: { status: 'loading', data: null, updatedAt: null, error: null },
  cities: { status: 'loading', data: [], updatedAt: null, error: null },
  alerts: {
    status: 'placeholder',
    data: { items: [], updatedAt: null, stale: false, degraded: true },
    error: null,
    scope: 'national'
  },
  quake: { status: 'placeholder', data: null, error: null },
  map: { overlay: 'wind', zoom: WINDY.defaultZoom, mounted: false, status: 'idle' },
  ui: { menuOpen: false, activeSection: 'cuaca', toast: null }
};

const state = { ...initialState };
const listeners = new Map();

function notify(slice, next, previous) {
  const subscribers = listeners.get(slice);
  if (!subscribers) return;

  for (const callback of [...subscribers]) {
    try {
      callback(next, previous);
    } catch (error) {
      // A broken widget must not stop the other widgets from updating.
      console.error(`[WJYAVA] Store subscriber failed for "${slice}":`, error);
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const store = {
  /**
   * Read a slice. Treat the returned object as read-only.
   * @param {keyof initialState} slice
   */
  select(slice) {
    return state[slice];
  },

  /**
   * Merge a patch into one slice and notify only that slice's subscribers.
   * @param {keyof initialState} slice
   * @param {object|unknown} patch
   * @param {{ silent?: boolean }} [options]
   */
  set(slice, patch, options = {}) {
    if (!(slice in state)) {
      throw new Error(`Unknown store slice: ${slice}`);
    }

    const previous = state[slice];
    const next = isPlainObject(previous) && isPlainObject(patch) ? { ...previous, ...patch } : patch;

    if (Object.is(next, previous)) return next;

    state[slice] = next;
    if (!options.silent) notify(slice, next, previous);
    return next;
  },

  /**
   * Subscribe to one slice. The callback fires immediately with the current
   * value, then on every change of that slice only.
   * @param {keyof initialState} slice
   * @param {(value: unknown, previous: unknown) => void} callback
   * @returns {() => void} unsubscribe
   */
  subscribe(slice, callback) {
    if (typeof callback !== 'function') return () => {};
    if (!listeners.has(slice)) listeners.set(slice, new Set());

    const subscribers = listeners.get(slice);
    subscribers.add(callback);

    try {
      callback(state[slice], undefined);
    } catch (error) {
      console.error(`[WJYAVA] Store subscriber failed for "${slice}":`, error);
    }

    return () => {
      subscribers.delete(callback);
      if (!subscribers.size) listeners.delete(slice);
    };
  }
};

export { initialState };
