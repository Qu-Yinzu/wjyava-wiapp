/**
 * ui/forecast.js
 * Renders five daily cards from the `weather` slice.
 */

import { qs, createEl, clear, iconEl, setText } from '../core/dom.js';
import { store } from '../core/store.js';
import { t, weatherLabel } from '../i18n/i18n.js';
import { getWeatherMeta } from '../utils/weather-code.js';
import { formatDay, formatShortDate, formatNumber, formatUpdated } from '../utils/format.js';
import { stateBox, actionButton } from './blocks.js';
import { restoreSkeleton, setRegionBusy } from './skeleton.js';

function rootEl() {
  return qs('[data-region="forecast"]');
}

function updatedEl() {
  return qs('[data-forecast-updated]');
}

function dayLabel(index, date) {
  if (index === 0) return t('common.today');
  if (index === 1) return t('common.tomorrow');
  return formatDay(date);
}

function forecastCard(day, index) {
  const meta = getWeatherMeta(day.weatherCode, 1);
  const card = createEl('article', {
    className: 'forecast-card',
    attrs: { 'aria-label': `${dayLabel(index, day.date)}, ${formatShortDate(day.date)}` }
  });

  card.append(createEl('p', { className: 'forecast-card__day', text: dayLabel(index, day.date) }));
  card.append(createEl('p', { className: 'forecast-card__date', text: formatShortDate(day.date) }));

  const icon = iconEl(meta.icon, `weather-icon weather-icon--md forecast-card__icon weather-icon--tone-${meta.tone}`);
  card.append(icon);

  const temps = createEl('div', { className: 'forecast-card__temps' });
  temps.append(createEl('span', { className: 'forecast-card__max', text: `${formatNumber(day.tempMax, 0)}°` }));
  temps.append(createEl('span', { className: 'forecast-card__min', text: `${formatNumber(day.tempMin, 0)}°` }));
  card.append(temps);

  card.append(createEl('p', { className: 'forecast-card__cond', text: weatherLabel(meta) }));

  const rain = createEl('p', { className: 'forecast-card__rain' });
  rain.append(iconEl('droplet', 'icon icon--xs'));
  rain.append(
    createEl('span', {
      text: typeof day.rainProbability === 'number'
        ? t('common.rainChance', { pct: formatNumber(day.rainProbability, 0) })
        : t('common.rainChanceEmpty')
    })
  );
  card.append(rain);

  return card;
}

function renderLoading() {
  setText(updatedEl(), '—');
  restoreSkeleton('forecast');
}

function renderError(root, error, onRetry) {
  setText(updatedEl(), '—');
  root.className = 'grid-forecast grid-forecast--state';
  root.setAttribute('aria-busy', 'false');
  clear(root);

  root.append(
    stateBox({
      variant: 'error',
      icon: 'alert-triangle',
      title: t('forecast.errorTitle'),
      text: error?.code === 'timeout' ? t('forecast.errorTimeout') : t('forecast.errorText'),
      actions: [actionButton(t('common.retry'), () => onRetry?.(), 'primary')]
    })
  );
}

function renderReady(root, slice, onRetry) {
  const data = slice.data;
  const days = Array.isArray(data?.daily) ? data.daily.slice(0, 5) : [];

  if (!days.length) {
    renderError(root, null, onRetry);
    return;
  }

  root.className = 'grid-forecast';
  root.setAttribute('aria-busy', 'false');
  clear(root);

  days.forEach((day, index) => root.append(forecastCard(day, index)));

  const timezone = data.timezone;
  const prefix = data.stale ? t('common.savedPrefix') : '';
  setText(updatedEl(), `${prefix}${formatUpdated(data.updatedAt, timezone)}`);
}

/**
 * @param {{ onRetry?: () => void }} [options]
 */
export function initForecast({ onRetry } = {}) {
  if (!rootEl()) return;

  const render = () => {
    const root = rootEl();
    if (!root) return;

    const slice = store.select('weather');

    switch (slice.status) {
      case 'loading':
        setRegionBusy('forecast', true);
        renderLoading();
        break;
      case 'ready':
        renderReady(root, slice, onRetry);
        break;
      case 'error':
        renderError(root, slice.error, onRetry);
        break;
      default:
        renderLoading();
    }
  };

  store.subscribe('weather', render);
  store.subscribe('meta', render);
}
