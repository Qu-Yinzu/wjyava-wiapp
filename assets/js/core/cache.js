/**
 * core/cache.js
 * Versioned localStorage cache with TTL and a quota guard.
 * Cache failures never throw into the UI; a miss simply returns null.
 */

import { CACHE } from '../config.js';

const PREFIX = `${CACHE.prefix}:${CACHE.version}:`;

function detectStorage() {
  try {
    const storage = window.localStorage;
    const probe = `${PREFIX}__probe__`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const storage = detectStorage();

function fullKey(key) {
  return `${PREFIX}${key}`;
}

function isQuotaError(error) {
  if (!error) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

function readEnvelope(raw) {
  try {
    const envelope = JSON.parse(raw);
    if (
      !envelope ||
      envelope.v !== CACHE.version ||
      typeof envelope.savedAt !== 'number' ||
      !Object.prototype.hasOwnProperty.call(envelope, 'data')
    ) {
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

function removeExpired() {
  if (!storage) return;
  const now = Date.now();

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(PREFIX)) continue;

    const envelope = readEnvelope(storage.getItem(key) || '');
    if (!envelope || now - envelope.savedAt > Number(envelope.ttl || 0)) {
      storage.removeItem(key);
    }
  }
}

function clearAll() {
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

function writeRaw(key, raw) {
  if (!storage) return false;

  try {
    storage.setItem(key, raw);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) return false;

    // Quota guard: drop expired entries, then all WJYAVA cache as a last resort.
    removeExpired();
    try {
      storage.setItem(key, raw);
      return true;
    } catch {
      clearAll();
      try {
        storage.setItem(key, raw);
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * @param {string} key
 * @param {{ allowStale?: boolean }} [options]
 * @returns {{ data: unknown, savedAt: number, ttl: number, stale: boolean } | null}
 */
export function cacheGet(key, { allowStale = true } = {}) {
  if (!storage) return null;

  const storageKey = fullKey(key);
  const raw = storage.getItem(storageKey);
  if (!raw) return null;

  const envelope = readEnvelope(raw);
  if (!envelope) {
    storage.removeItem(storageKey);
    return null;
  }

  const stale = Date.now() - envelope.savedAt > Number(envelope.ttl || 0);
  if (stale && !allowStale) return null;

  return {
    data: envelope.data,
    savedAt: envelope.savedAt,
    ttl: Number(envelope.ttl || 0),
    stale
  };
}

export function cacheSet(key, data, ttl) {
  if (!storage) return false;

  const raw = JSON.stringify({
    v: CACHE.version,
    savedAt: Date.now(),
    ttl: Number(ttl) || 0,
    data
  });

  if (raw.length > CACHE.maxEntryBytes) return false;
  return writeRaw(fullKey(key), raw);
}

export function cacheRemove(key) {
  if (!storage) return;
  storage.removeItem(fullKey(key));
}

export function cacheClear() {
  clearAll();
}

export function cachePrune() {
  removeExpired();
}
