/**
 * lib/cache.js
 * Tiny in-memory cache with TTL inspection and a hard 6-hour retention cap
 * for stale fallback. Values are frozen so callers cannot mutate the cache.
 */

const entries = new Map();
const MAX_STALE_MS = 6 * 60 * 60 * 1000;

export function cacheGet(key, { allowStale = false } = {}) {
  const entry = entries.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.savedAt;
  if (!allowStale && age > entry.ttl) return null;
  if (allowStale && age > MAX_STALE_MS) {
    entries.delete(key);
    return null;
  }

  return { ...entry };
}

export function cacheSet(key, value, ttl) {
  entries.set(key, {
    value: Object.freeze(value),
    savedAt: Date.now(),
    ttl: Number(ttl) || 0
  });
}

export function cacheRemove(key) {
  entries.delete(key);
}

export function cacheClear() {
  entries.clear();
}

export function cacheInfo() {
  const now = Date.now();
  return [...entries.entries()].map(([key, entry]) => ({
    key,
    ageSeconds: Math.max(0, Math.round((now - entry.savedAt) / 1000)),
    ttlSeconds: Math.round(entry.ttl / 1000),
    fresh: now - entry.savedAt <= entry.ttl
  }));
}
