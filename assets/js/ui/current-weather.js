/**
 * ui/current-weather.js
 * Renders the hero weather card from the `weather` slice only.
 * Weather updates therefore never touch the map iframe.
 */

import { qs, createEl, clear, iconEl } from '../core/dom.js';
import { store } from '../core/store.js';
import { t, weatherLabel } from '../i18n/i18n.js';
import { getWeatherMeta } from '../utils/weather-code.js';
import { formatCoordinate, formatNumber, formatInteger, formatUpdated } from '../utils/format.js';
import { stateBox, actionButton, metric } from './blocks.js';
import { restoreSkeleton, setRegionBusy } from './skeleton.js';

function uvCategory(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value < 3) return t('current.uvLow');
  if (value < 6) return t('current.uvModerate');
  if (value < 8) return t('current.uvHigh');
  if (value < 11) return t('current.uvVeryHigh');
  return t('current.uvExtreme');
}

function rootEl() {
  return qs('[data-region="current"]');
}

function prepareRoot(root) {
  root.className = 'card weather-card';
  root.setAttribute('aria-busy', 'false');
  clear(root);
}

function renderLoading() {
  restoreSkeleton('current');
}

function renderError(root, error, onRetry) {
  prepareRoot(root);
  root.append(
    stateBox({
      variant: 'error',
      icon: 'alert-triangle',
      title: t('current.errorTitle'),
      text: error?.code === 'timeout' ? t('current.errorTimeout') : t('current.errorText'),
      actions: [actionButton(t('common.retry'), () => onRetry?.(), 'primary')]
    })
  );
}

function renderEmpty(root, onRetry) {
  prepareRoot(root);
  root.append(
    stateBox({
      variant: 'empty',
      icon: 'info',
      title: t('current.emptyTitle'),
      text: t('current.emptyText'),
      actions: [actionButton(t('common.retry'), () => onRetry?.())]
    })
  );
}

function renderReady(root, slice, onRetry) {
  const data = slice.data;
  if (!data?.current) {
    renderEmpty(root, onRetry);
    return;
  }

  prepareRoot(root);

  const { current, location, timezone } = data;
  const meta = getWeatherMeta(current.weatherCode, current.isDay);

  const top = createEl('div', { className: 'weather-card__top' });

  const place = createEl('div', { className: 'weather-card__place' });
  place.append(iconEl('pin', 'icon weather-card__pin'));

  const placeText = createEl('div', { className: 'weather-card__place-text' });
  placeText.append(createEl('h3', { className: 'weather-card__city', text: location.name || t('common.location') }));

  const region = [location.admin1, location.country].filter(Boolean).join(' · ');
  placeText.append(
    createEl('p', {
      className: 'weather-card__country',
      text: region || `${formatCoordinate(location.lat, 'lat')} · ${formatCoordinate(location.lon, 'lon')}`
    })
  );

  place.append(placeText);

  const metaCol = createEl('div', { className: 'weather-card__meta' });
  metaCol.append(
    createEl('span', {
      className: 'weather-card__badge',
      text: data.stale ? t('common.savedBadge') : t('current.badgeLive')
    })
  );
  metaCol.append(
    createEl('span', {
      className: 'weather-card__time',
      text: data.stale
        ? `${t('common.savedPrefix')}${formatUpdated(data.updatedAt, timezone)}`
        : formatUpdated(data.updatedAt, timezone)
    })
  );

  top.append(place, metaCol);

  const main = createEl('div', { className: 'weather-card__main' });
  const tempBlock = createEl('div', { className: 'weather-card__temp-block' });

  const temp = createEl('div', { className: 'temp' });
  temp.append(createEl('span', { text: formatNumber(current.temperature, 0) }));
  if (typeof current.temperature === 'number') {
    temp.append(createEl('span', { className: 'temp__unit', text: '°C' }));
  }
  tempBlock.append(temp);

  tempBlock.append(createEl('p', { className: 'weather-card__cond', text: weatherLabel(meta) }));

  const feels = createEl('p', { className: 'weather-card__feels', text: t('current.feelsLike') });
  feels.append(createEl('strong', { text: `${formatNumber(current.apparentTemperature, 0)}°` }));
  if (typeof current.apparentTemperature === 'number') {
    feels.append(document.createTextNode('C'));
  }
  tempBlock.append(feels);

  const visual = createEl('div', { className: 'weather-card__visual' });
  visual.append(
    createEl('span', {
      className: 'weather-card__badge',
      text: current.isDay ? t('common.day') : t('common.night')
    })
  );
  visual.append(iconEl(meta.icon, `weather-icon weather-icon--xl weather-icon--tone-${meta.tone}`));

  main.append(tempBlock, visual);

  const metrics = createEl('div', { className: 'metric-grid' });
  metrics.append(
    metric({
      label: t('current.humidity'),
      icon: 'droplet',
      value: formatInteger(current.humidity),
      unit: typeof current.humidity === 'number' ? '%' : ''
    }),
    metric({
      label: t('current.wind'),
      icon: 'wind',
      value: formatNumber(current.windSpeed, 0),
      unit: typeof current.windSpeed === 'number' ? t('common.windUnit') : ''
    }),
    metric({
      label: t('current.uv'),
      icon: 'sun-dim',
      value: formatNumber(current.uvIndex, 1),
      unit: uvCategory(current.uvIndex),
      caution: typeof current.uvIndex === 'number' && current.uvIndex >= 8
    })
  );

  root.append(top, main, metrics);
}

/**
 * @param {{ onRetry?: () => void }} [options]
 */
export function initCurrentWeather({ onRetry } = {}) {
  const root = rootEl();
  if (!root) return;

  const render = () => {
    const current = rootEl();
    if (!current) return;

    const slice = store.select('weather');

    switch (slice.status) {
      case 'loading':
        setRegionBusy('current', true);
        renderLoading();
        break;
      case 'ready':
        renderReady(current, slice, onRetry);
        break;
      case 'error':
        renderError(current, slice.error, onRetry);
        break;
      default:
        renderEmpty(current, onRetry);
    }
  };

  store.subscribe('weather', render);
  store.subscribe('meta', render);
}
