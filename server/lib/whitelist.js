/**
 * lib/whitelist.js
 * The only URLs this proxy is ever allowed to request.
 * Client input never becomes a URL: the endpoint accepts `lang` only.
 */

export const RSS_URLS = Object.freeze({
  id: 'https://www.bmkg.go.id/alerts/nowcast/id/rss.xml',
  en: 'https://www.bmkg.go.id/alerts/nowcast/en/rss.xml'
});

export const CAP_URL_PATTERN =
  /^https:\/\/www\.bmkg\.go\.id\/alerts\/nowcast\/(id|en)\/[A-Za-z0-9_.-]+\.xml$/;

export const OFFICIAL_ALERTS_PAGE = 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca.bmkg';

export function isSupportedLanguage(value) {
  return value === 'id' || value === 'en';
}

export function rssUrlFor(lang) {
  return RSS_URLS[isSupportedLanguage(lang) ? lang : 'id'];
}

export function isAllowedCapUrl(value) {
  return typeof value === 'string' && CAP_URL_PATTERN.test(value);
}
