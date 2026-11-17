/**
 * ui/navbar.js
 * Locale switch (persisted, triggers an alerts refetch), geolocation →
 * reverse geocode → weather/map pipeline, and mobile menu affordances.
 * ScrollSpy and close-on-click live in core/router.js.
 */

import { qs, qsa, setText } from '../core/dom.js';
import { store } from '../core/store.js';
import { getLocale, setLocale, syncLocaleButtons, t } from '../i18n/i18n.js';
import {
  GeoError,
  canGeolocate,
  coordinateLocation,
  geoMessageKey,
  requestPosition,
  reverseGeocode
} from '../services/geo.service.js';
import { showToast, announce } from './feedback.js';

/**
 * @param {{
 *   onLocaleChange?: (locale: 'id'|'en') => void,
 *   onGeolocate?: (location: object) => void
 * }} [handlers]
 */
export function initNavbar({ onLocaleChange, onGeolocate } = {}) {
  const localeButtons = qsa('[data-locale]');
  syncLocaleButtons(document);

  for (const button of localeButtons) {
    button.addEventListener('click', () => {
      const locale = button.dataset.locale === 'en' ? 'en' : 'id';
      if (locale === getLocale()) return;

      setLocale(locale);
      syncLocaleButtons(document);
      store.set('meta', { locale });

      showToast(locale === 'en' ? t('toast.localeEn') : t('toast.localeId'));
      onLocaleChange?.(locale);
    });
  }

  const geolocate = qs('[data-action="geolocate"]');
  const geolocateLabel = geolocate?.querySelector('span');
  let busy = false;

  geolocate?.addEventListener('click', async () => {
    if (busy) return;

    if (!canGeolocate()) {
      showToast(t('toast.geoUnsupported'), { tone: 'warn' });
      qs('#city-input')?.focus();
      return;
    }

    busy = true;
    geolocate.disabled = true;
    geolocate.setAttribute('aria-busy', 'true');
    if (geolocateLabel) setText(geolocateLabel, t('nav.geolocating'));
    announce(t('toast.geoLocating'));

    try {
      const position = await requestPosition();
      let location = null;
      let usedCoordinates = false;

      try {
        const result = await reverseGeocode({
          lat: position.lat,
          lon: position.lon,
          lang: getLocale()
        });
        location = result.location;
      } catch {
        location = coordinateLocation(position);
        usedCoordinates = true;
      }

      if (!location) {
        location = { ...coordinateLocation(position), name: t('common.location') };
        usedCoordinates = true;
      } else if (!location.name) {
        location = { ...location, name: t('common.location') };
      }

      onGeolocate?.(location);
      showToast(
        usedCoordinates
          ? t('toast.geoCoordinates')
          : t('toast.geoFound', { place: location.name })
      );
    } catch (error) {
      const code = error instanceof GeoError ? error.code : 'failed';
      showToast(t(geoMessageKey(code)), { tone: 'warn' });
      qs('#city-input')?.focus();
    } finally {
      busy = false;
      geolocate.disabled = false;
      geolocate.removeAttribute('aria-busy');
      if (geolocateLabel) setText(geolocateLabel, t('nav.geolocate'));
    }
  });
}
