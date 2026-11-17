/**
 * lib/parser.js
 * RSS + CAP XML normalisation. Pure functions only: no network, no cache.
 * Missing fields stay null; nothing is invented.
 */

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: false,
  processEntities: true
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && typeof value['#text'] === 'string') {
    return value['#text'].replace(/\s+/g, ' ').trim();
  }
  return '';
}

function nullable(value) {
  const cleaned = text(value);
  return cleaned || null;
}

/** Preserve an offset-bearing ISO timestamp; convert other valid dates to ISO. */
export function normaliseTimestamp(value) {
  const raw = nullable(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

export function levelFromSeverity(severity) {
  switch (text(severity)) {
    case 'Extreme':
    case 'Severe':
      return 'critical';
    case 'Moderate':
      return 'warning';
    case 'Minor':
      return 'caution';
    default:
      return 'unknown';
  }
}

/**
 * @param {string} xml RSS document
 * @returns {{ lastBuildDate: string|null, items: Array<object> }}
 */
export function parseRss(xml) {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel || typeof channel !== 'object') {
    throw new Error('RSS BMKG tidak memiliki elemen channel.');
  }

  const items = asArray(channel.item).map((raw) => ({
    title: text(raw?.title),
    link: text(raw?.link),
    description: text(raw?.description),
    pubDate: normaliseTimestamp(raw?.pubDate),
    guid: text(raw?.guid)
  }));

  return {
    lastBuildDate: normaliseTimestamp(channel.lastBuildDate) || normaliseTimestamp(channel.pubDate),
    items: items.filter((item) => item.title || item.link)
  };
}

/**
 * @param {string} xml CAP 1.2 document
 * @returns {object} normalised CAP fields
 */
export function parseCap(xml) {
  const doc = parser.parse(xml);
  const alert = doc?.alert;
  if (!alert || typeof alert !== 'object') {
    throw new Error('CAP BMKG tidak memiliki elemen alert.');
  }

  const info = asArray(alert.info).find((entry) => entry && typeof entry === 'object') || {};
  const areas = asArray(info.area)
    .map((entry) => nullable(entry?.areaDesc))
    .filter(Boolean);

  return {
    headline: nullable(info.headline),
    event: nullable(info.event),
    severity: nullable(info.severity),
    certainty: nullable(info.certainty),
    urgency: nullable(info.urgency),
    onset: normaliseTimestamp(info.onset),
    expires: normaliseTimestamp(info.expires),
    area: areas.length ? areas.join('; ') : null,
    description: nullable(info.description),
    senderName: nullable(info.senderName),
    status: nullable(alert.status),
    identifier: nullable(alert.identifier)
  };
}
