/**
 * WJYAVA BMKG proxy — Fase 3.
 * One endpoint: GET /api/bmkg/alerts?lang=id|en
 *
 * The client can never supply a URL. The proxy fetches the official BMKG RSS
 * feed, follows CAP detail links that pass a strict host+path whitelist, and
 * returns one normalised JSON payload.
 */

import { createHash } from 'node:crypto';
import compression from 'compression';
import cors from 'cors';
import express from 'express';

import { getAlerts, getCacheInfo, config } from './lib/bmkg.js';
import { isSupportedLanguage, rssUrlFor } from './lib/whitelist.js';

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'If-None-Match'],
    maxAge: 86400
  })
);

app.get('/health', (_req, res) => {
  const cache = getCacheInfo();
  const newestAge = cache.length
    ? Math.min(...cache.map((entry) => entry.ageSeconds))
    : null;

  res.json({
    ok: true,
    upstream: 'BMKG',
    cacheEntries: cache.length,
    cacheAgeSeconds: newestAge,
    cacheTtlSeconds: config.cacheTtlSeconds,
    maxAlerts: config.maxAlerts
  });
});

app.get('/api/bmkg/alerts', async (req, res) => {
  const started = Date.now();
  const rawLang = typeof req.query.lang === 'string' ? req.query.lang : 'id';
  const lang = rawLang || 'id';

  if (!isSupportedLanguage(lang)) {
    res.status(400).json({
      error: 'invalid_language',
      message: 'Parameter lang hanya menerima "id" atau "en".',
      degraded: true
    });
    return;
  }

  try {
    const payload = await getAlerts(lang);
    const body = JSON.stringify(payload);
    const etag = `"${createHash('sha1').update(body).digest('hex')}"`;

    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${payload.stale ? 60 : config.cacheTtlSeconds}`,
      ETag: etag,
      'Vary': 'Origin'
    });

    if (payload.stale) {
      res.set('Warning', '110 - "Response is Stale"');
    }

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    console.log(
      `[bmkg] lang=${lang} status=200 items=${payload.items.length} stale=${payload.stale} ${Date.now() - started}ms`
    );
    res.status(200).send(body);
  } catch (error) {
    const sourceUrl = rssUrlFor(lang);
    console.error(
      `[bmkg] lang=${lang} status=502 ${Date.now() - started}ms reason=${error?.message || 'unknown'}`
    );
    res.status(502).json({
      error: 'upstream_unavailable',
      message: 'Sumber BMKG tidak dapat dijangkau. Coba lagi atau buka tautan resmi BMKG.',
      degraded: true,
      sourceUrl
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((error, _req, res, _next) => {
  console.error('[bmkg] unhandled error:', error?.message || error);
  res.status(500).json({ error: 'internal_error', degraded: true });
});

const server = app.listen(PORT, () => {
  console.log(`WJYAVA BMKG proxy listening on http://localhost:${PORT}`);
  console.log(`  GET /api/bmkg/alerts?lang=id|en`);
  console.log(`  GET /health`);
});

function shutdown(signal) {
  console.log(`\n[bmkg] ${signal} received, closing proxy…`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app };
