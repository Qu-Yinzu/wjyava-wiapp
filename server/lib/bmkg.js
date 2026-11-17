/**
 * lib/bmkg.js
 * Fetch the official BMKG RSS feed, aggregate CAP detail XML for each item,
 * and expose one clean JSON payload. Strict whitelist + timeouts + cache.
 */

import { cacheGet, cacheInfo, cacheSet } from './cache.js';
import { isAllowedCapUrl, rssUrlFor } from './whitelist.js';
import { levelFromSeverity, parseCap, parseRss } from './parser.js';

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 300);
const MAX_ALERTS = Math.min(8, Math.max(5, Number(process.env.MAX_ALERTS || 8)));
const RSS_TIMEOUT_MS = 8_000;
const CAP_TIMEOUT_MS = 5_000;
const CAP_BUDGET_MS = 9_000;
const MAX_RSS_BYTES = 1024 * 1024;
const MAX_CAP_BYTES = 1024 * 1024;
const USER_AGENT = 'WJYAVA-Proxy/1.1 (+https://www.bmkg.go.id/)';

const inflight = new Map();

/** Fetch text with an AbortController timeout and a bounded body size. */
async function fetchText(url, { timeout = 8_000, maxBytes = 1024 * 1024, redirects = 1 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/xml, text/xml, application/rss+xml, */*'
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects <= 0) throw new Error('Terlalu banyak redirect upstream.');
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect tanpa header Location.');
      const next = new URL(location, url);
      // Redirect hanya boleh tetap di host yang sama.
      if (next.protocol !== 'https:' || next.host !== new URL(url).host) {
        throw new Error('Redirect keluar dari host BMKG ditolak.');
      }
      return fetchText(next.toString(), { timeout, maxBytes, redirects: redirects - 1 });
    }

    if (!response.ok) {
      throw new Error(`BMKG membalas HTTP ${response.status}.`);
    }

    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      throw new Error('Ukuran bodi BMKG melebihi batas.');
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Run an async worker over items with a fixed concurrency pool. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(runners);
  return results;
}

function unavailableCap(reason) {
  return { ok: false, reason };
}

async function fetchCap(url, timeout) {
  if (!isAllowedCapUrl(url)) return unavailableCap('URL CAP tidak masuk whitelist.');

  try {
    const xml = await fetchText(url, { timeout, maxBytes: MAX_CAP_BYTES });
    return { ok: true, value: parseCap(xml) };
  } catch (error) {
    return unavailableCap(error?.message || 'Detail CAP gagal dimuat.');
  }
}

function normaliseItem(rssItem, cap, fallbackReason) {
  const detailOk = cap?.ok === true;
  const detail = detailOk ? cap.value : {};
  const severity = detailOk ? detail.severity : null;

  return {
    id: rssItem.guid || detail.identifier || rssItem.link || rssItem.title,
    headline: (detailOk ? detail.headline : null) || rssItem.title || null,
    event: (detailOk ? detail.event : null) || null,
    severity,
    level: levelFromSeverity(severity),
    certainty: (detailOk ? detail.certainty : null) || null,
    urgency: (detailOk ? detail.urgency : null) || null,
    area: (detailOk ? detail.area : null) || null,
    onset: (detailOk ? detail.onset : null) || null,
    expires: (detailOk ? detail.expires : null) || null,
    publishedAt: rssItem.pubDate || null,
    description: (detailOk ? detail.description : null) || rssItem.description || null,
    senderName: (detailOk ? detail.senderName : null) || null,
    status: (detailOk ? detail.status : null) || null,
    url: rssItem.link || null,
    detailStatus: detailOk ? 'ok' : 'unavailable',
    detailError: detailOk ? null : fallbackReason || 'Detail CAP tidak tersedia.'
  };
}

async function buildPayload(lang) {
  const sourceUrl = rssUrlFor(lang);
  const rssXml = await fetchText(sourceUrl, {
    timeout: RSS_TIMEOUT_MS,
    maxBytes: MAX_RSS_BYTES
  });

  const rss = parseRss(rssXml);
  const selected = rss.items.slice(0, MAX_ALERTS);
  const deadline = Date.now() + CAP_BUDGET_MS;

  const caps = await mapPool(selected, 4, async (item) => {
    if (!item.link) return unavailableCap('Item RSS tidak memiliki tautan CAP.');
    const remaining = deadline - Date.now();
    if (remaining <= 0) return unavailableCap('Anggaran waktu detail CAP habis.');
    return fetchCap(item.link, Math.min(CAP_TIMEOUT_MS, remaining));
  });

  const items = selected.map((item, index) =>
    normaliseItem(item, caps[index], caps[index]?.reason)
  );

  const newestPublished = items
    .map((item) => item.publishedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    source: 'BMKG',
    scope: 'national',
    language: lang,
    sourceUrl,
    updatedAt: rss.lastBuildDate || newestPublished || new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    stale: false,
    items,
    degraded: false
  };
}

/**
 * @param {'id'|'en'} lang
 * @param {{ force?: boolean }} [options]
 */
export async function getAlerts(lang, { force = false } = {}) {
  const language = lang === 'en' ? 'en' : 'id';
  const key = `alerts:${language}`;

  if (!force) {
    const fresh = cacheGet(key);
    if (fresh) return { ...fresh.value, stale: false };
  }

  if (inflight.has(key)) return inflight.get(key);

  const request = buildPayload(language)
    .then((payload) => {
      cacheSet(key, payload, CACHE_TTL_SECONDS * 1000);
      return payload;
    })
    .catch((error) => {
      const stale = cacheGet(key, { allowStale: true });
      if (stale) {
        return {
          ...stale.value,
          stale: true,
          degraded: false,
          cachedAt: new Date(stale.savedAt).toISOString(),
          warning: 'Response is stale'
        };
      }
      throw error;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function getCacheInfo() {
  return cacheInfo();
}

export const config = Object.freeze({
  cacheTtlSeconds: CACHE_TTL_SECONDS,
  maxAlerts: MAX_ALERTS,
  rssTimeoutMs: RSS_TIMEOUT_MS,
  capTimeoutMs: CAP_TIMEOUT_MS
});
