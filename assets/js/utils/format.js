/**
 * utils/format.js
 * Intl formatting that follows the timezone returned by Open-Meteo.
 * Timestamps are always formatted in the location's own timezone.
 */

import { DEFAULT_TIMEZONE } from '../config.js';
import { localeTag, t } from '../i18n/i18n.js';

const formatterCache = new Map();

function getFormatter(key, factory) {
  if (!formatterCache.has(key)) formatterCache.set(key, factory());
  return formatterCache.get(key);
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`);
  }
  return toDate(value);
}

function timeFormatter(timeZone) {
  return getFormatter(`time:${localeTag()}:${timeZone}`, () =>
    new Intl.DateTimeFormat(localeTag(), {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
      timeZoneName: 'short'
    })
  );
}

function dateTimeFormatter(timeZone) {
  return getFormatter(`datetime:${localeTag()}:${timeZone}`, () =>
    new Intl.DateTimeFormat(localeTag(), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
      timeZoneName: 'short'
    })
  );
}

/**
 * Parse an Open-Meteo local timestamp (no offset) using the response's
 * utc_offset_seconds, then return an ISO instant. This keeps the displayed
 * local time identical to the location's wall clock.
 * @param {string} localIso e.g. "2026-11-16T11:15"
 * @param {number} utcOffsetSeconds
 */
export function parseLocalIso(localIso, utcOffsetSeconds = 0) {
  if (typeof localIso !== 'string' || !localIso.trim()) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(localIso)) {
    const date = toDate(localIso);
    return date ? date.toISOString() : null;
  }

  const [datePart, timePart = '00:00:00'] = localIso.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second = 0] = timePart.split(':').map(Number);

  if (![year, month, day, hour, minute, second].every((part) => Number.isFinite(part))) {
    return null;
  }

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - Number(utcOffsetSeconds || 0) * 1000;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatTime(iso, timeZone = DEFAULT_TIMEZONE) {
  const date = toDate(iso);
  if (!date) return '—';
  return timeFormatter(timeZone || DEFAULT_TIMEZONE).format(date);
}

export function formatDateTime(iso, timeZone = DEFAULT_TIMEZONE) {
  const date = toDate(iso);
  if (!date) return '—';
  return dateTimeFormatter(timeZone || DEFAULT_TIMEZONE).format(date);
}

/** Daily dates from Open-Meteo are calendar dates, so format them in UTC. */
export function formatDay(dateIso) {
  const date = dateOnly(dateIso);
  if (!date) return '—';

  return getFormatter(`day:${localeTag()}:utc`, () =>
    new Intl.DateTimeFormat(localeTag(), { weekday: 'long', timeZone: 'UTC' })
  ).format(date);
}

export function formatShortDate(dateIso) {
  const date = dateOnly(dateIso);
  if (!date) return '—';

  return getFormatter(`date:${localeTag()}:utc`, () =>
    new Intl.DateTimeFormat(localeTag(), { day: 'numeric', month: 'short', timeZone: 'UTC' })
  ).format(date);
}

export function formatUpdated(iso, timeZone = DEFAULT_TIMEZONE) {
  return t('common.updated', { time: formatTime(iso, timeZone) });
}

/**
 * CAP timestamps carry an explicit offset. Use the matching Indonesian zone so
 * a WITA expiry is not shifted to WIB, and label it WIB/WITA/WIT explicitly.
 */
export function formatAlertDateTime(iso) {
  const date = toDate(iso);
  if (!date) return '—';

  const match = typeof iso === 'string' ? iso.match(/([+-])(\d{2}):?(\d{2})$/) : null;
  let timeZone = DEFAULT_TIMEZONE;
  let zoneLabel = '';

  if (match) {
    const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1);
    if (minutes === 420) {
      timeZone = 'Asia/Jakarta';
      zoneLabel = 'WIB';
    } else if (minutes === 480) {
      timeZone = 'Asia/Makassar';
      zoneLabel = 'WITA';
    } else if (minutes === 540) {
      timeZone = 'Asia/Jayapura';
      zoneLabel = 'WIT';
    }
  }

  const formatted = getFormatter(`alert:${localeTag()}:${timeZone}`, () =>
    new Intl.DateTimeFormat(localeTag(), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone
    })
  ).format(date);

  return zoneLabel ? `${formatted} ${zoneLabel}` : formatted;
}

export function formatNumber(value, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';

  return new Intl.NumberFormat(localeTag(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export function formatInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(localeTag()).format(Math.round(value));
}

export function formatCoordinate(value, axis) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const hemisphere = axis === 'lat' ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E';
  return `${Math.abs(value).toFixed(2)}°${hemisphere}`;
}
