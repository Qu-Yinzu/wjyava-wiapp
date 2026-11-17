/**
 * core/http.js
 * JSON fetch wrapper with:
 *  - 8s AbortController timeout
 *  - up to 2 retries (500 ms, 1500 ms) for network errors / 5xx
 *  - in-flight deduplication by URL
 *  - monotonic request-id helpers for race-free searches
 */

import { HTTP } from '../config.js';

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, url?: string, code?: string, cause?: unknown }} [meta]
   */
  constructor(message, { status = 0, url = '', code = 'http', cause } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.code = code;
    this.cause = cause;
  }
}

export function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 'aborted');
}

export function buildUrl(base, params = {}) {
  const url = new URL(base);

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestOnce(url, { signal, timeout }) {
  const controller = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) throw new DOMException('Permintaan dibatalkan.', 'AbortError');
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} untuk ${url}`, {
        status: response.status,
        url,
        code: 'status'
      });
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new HttpError('Respons API bukan JSON yang valid.', {
        url,
        code: 'parse',
        cause: error
      });
    }
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException('Permintaan dibatalkan.', 'AbortError');
    }

    if (timedOut) {
      throw new HttpError(`Permintaan melebihi ${timeout / 1000} detik.`, {
        url,
        code: 'timeout',
        cause: error
      });
    }

    if (error instanceof HttpError) throw error;

    throw new HttpError('Jaringan tidak tersedia atau permintaan diblokir.', {
      url,
      code: 'network',
      cause: error
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

function isRetriable(error) {
  if (!error) return false;
  if (error.code === 'timeout' || error.code === 'network') return true;
  return typeof error.status === 'number' && error.status >= 500;
}

async function withRetry(url, { signal, timeout, retries, backoff }) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestOnce(url, { signal, timeout });
    } catch (error) {
      lastError = error;

      if (isAbortError(error) || signal?.aborted) throw error;
      if (!isRetriable(error) || attempt === retries) break;

      const delay = backoff[Math.min(attempt, backoff.length - 1)];
      await sleep(delay);
    }
  }

  throw lastError;
}

const inflight = new Map();

/**
 * Fetch and parse JSON. Identical concurrent requests share one promise.
 * @param {string} url
 * @param {{ signal?: AbortSignal, timeout?: number, retries?: number, backoff?: number[], dedupeKey?: string }} [options]
 */
export function fetchJson(url, options = {}) {
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException('Permintaan dibatalkan.', 'AbortError'));
  }

  // Only signal-free calls are deduplicated. A caller-owned AbortSignal must
  // never be shared, otherwise aborting one search can cancel a later one.
  const canDedupe = !options.signal;
  const key = options.dedupeKey || url;
  const existing = canDedupe ? inflight.get(key) : null;
  if (existing) return existing;

  const promise = withRetry(url, {
    signal: options.signal,
    timeout: options.timeout ?? HTTP.timeout,
    retries: options.retries ?? HTTP.retries,
    backoff: options.backoff ?? HTTP.backoff
  }).finally(() => {
    if (canDedupe && inflight.get(key) === promise) inflight.delete(key);
  });

  if (canDedupe) inflight.set(key, promise);
  return promise;
}

let requestSequence = 0;
const latestByGroup = new Map();

/**
 * Start a new logical request. Only the newest id in a group is "current".
 * @param {string} group
 */
export function issueRequestId(group = 'default') {
  requestSequence += 1;
  latestByGroup.set(group, requestSequence);
  return requestSequence;
}

export function isLatestRequest(group, id) {
  return latestByGroup.get(group) === id;
}

export function clearRequestGroup(group = 'default') {
  latestByGroup.delete(group);
}
