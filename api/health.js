import { getCacheInfo, config } from '../server/lib/bmkg.js';

export default function handler(_req, res) {
  const cache = getCacheInfo();
  const newestAge = cache.length
    ? Math.min(...cache.map((entry) => entry.ageSeconds))
    : null;

  res.status(200).json({
    ok: true,
    upstream: 'BMKG',
    cacheEntries: cache.length,
    cacheAgeSeconds: newestAge,
    cacheTtlSeconds: config.cacheTtlSeconds,
    maxAlerts: config.maxAlerts
  });
}