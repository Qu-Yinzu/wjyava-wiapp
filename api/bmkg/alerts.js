import { createHash } from 'node:crypto';
import { getAlerts, config } from '../../server/lib/bmkg.js';
import { isSupportedLanguage, rssUrlFor } from '../../server/lib/whitelist.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const rawLang = typeof req.query?.lang === 'string' ? req.query.lang : 'id';
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
    const ttl = payload.stale ? 60 : config.cacheTtlSeconds;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=60`
    );
    res.setHeader('ETag', etag);

    if (payload.stale) {
      res.setHeader('Warning', '110 - "Response is Stale"');
    }

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.status(200).send(body);
  } catch (error) {
    res.status(502).json({
      error: 'upstream_unavailable',
      message: 'Sumber BMKG tidak dapat dijangkau. Coba lagi atau buka tautan resmi BMKG.',
      degraded: true,
      sourceUrl: rssUrlFor(lang)
    });
  }
}