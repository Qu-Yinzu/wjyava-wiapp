/**
 * i18n/i18n.js
 * Flat-dictionary bilingual layer (id/en) with localStorage persistence.
 *
 * Static markup uses data attributes:
 *   data-i18n="key"              → textContent
 *   data-i18n-placeholder="key"  → placeholder
 *   data-i18n-aria-label="key"   → aria-label
 *   data-i18n-title="key"        → title
 *
 * Dynamic panels call t(key, vars) and re-render when meta.locale changes.
 */

import id from './id.js';
import en from './en.js';

export const LOCALES = Object.freeze(['id', 'en']);
export const DEFAULT_LOCALE = 'id';

const STORAGE_KEY = 'wjyava-locale';
const DICTIONARIES = Object.freeze({ id, en });

let currentLocale = DEFAULT_LOCALE;

function normaliseLocale(value) {
  return value === 'en' ? 'en' : DEFAULT_LOCALE;
}

function readStoredLocale() {
  try {
    return normaliseLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

function persistLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be unavailable in private mode. The in-memory locale still works.
  }
}

export function getLocale() {
  return currentLocale;
}

export function localeTag() {
  return currentLocale === 'en' ? 'en-US' : 'id-ID';
}

export function isEnglish() {
  return currentLocale === 'en';
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  const dictionary = DICTIONARIES[currentLocale] || DICTIONARIES[DEFAULT_LOCALE];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];
  const template = dictionary[key] ?? fallback[key] ?? key;

  if (!vars || typeof template !== 'string') return template;

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Weather labels arrive as labelId/labelEn pairs from weather-code.js. */
export function weatherLabel(meta) {
  if (!meta) return t('cities.condUnavailable');
  return currentLocale === 'en' ? meta.labelEn : meta.labelId;
}

/**
 * Translate every static hook below the given root.
 * Only leaf text nodes are touched, so markup structure is never replaced.
 */
export function applyStaticTranslations(root = document) {
  if (!root) return;

  for (const element of root.querySelectorAll('[data-i18n]')) {
    const key = element.getAttribute('data-i18n');
    if (key) element.textContent = t(key);
  }

  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key) element.setAttribute('placeholder', t(key));
  }

  for (const element of root.querySelectorAll('[data-i18n-aria-label]')) {
    const key = element.getAttribute('data-i18n-aria-label');
    if (key) element.setAttribute('aria-label', t(key));
  }

  for (const element of root.querySelectorAll('[data-i18n-title]')) {
    const key = element.getAttribute('data-i18n-title');
    if (key) element.setAttribute('title', t(key));
  }
}

/**
 * @param {'id'|'en'} locale
 * @param {{ persist?: boolean, apply?: boolean }} [options]
 */
export function setLocale(locale, { persist = true, apply = true } = {}) {
  const next = normaliseLocale(locale);
  currentLocale = next;

  if (persist) persistLocale(next);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next;
    if (apply) applyStaticTranslations(document);
  }

  return next;
}

/** Restore the saved locale at boot. */
export function initI18n() {
  return setLocale(readStoredLocale(), { persist: false });
}

/** Reflect the active locale on the ID/EN segmented control. */
export function syncLocaleButtons(root = document) {
  const buttons = root ? Array.from(root.querySelectorAll('[data-locale]')) : [];
  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(normaliseLocale(button.dataset.locale) === currentLocale));
  }
}
