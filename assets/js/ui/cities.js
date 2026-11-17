/**
 * ui/cities.js
 * Five independent city cards. One failed city only affects its own card and
 * exposes a local retry action.
 */

import { qs, createEl, clear, iconEl, setText } from '../core/dom.js';
import { store } from '../core/store.js';
import { t, weatherLabel } from '../i18n/i18n.js';
import { getWeatherMeta } from '../utils/weather-code.js';
import { formatNumber, formatUpdated } from '../utils/format.js';
import { stateBox, actionButton } from './blocks.js';
import { restoreSkeleton, setRegionBusy } from './skeleton.js';

function rootEl() {
  return qs('[data-region="cities"]');
}

function updatedEl() {
  return qs('[data-cities-updated]');
}

function cityHead(city, data) {
  const head = createEl('div', { className: 'city-card__head' });
  const text = createEl('div');

  text.append(createEl('h3', { className: 'city-card__name', text: city.name }));
  text.append(
    createEl('p', {
      className: 'city-card__region',
      text: [city.admin1, city.country].filter(Boolean).join(' · ') || t('common.indonesia')
    })
  );

  head.append(text);

  if (data?.current) {
    const meta = getWeatherMeta(data.current.weatherCode, data.current.isDay);
    head.append(iconEl(meta.icon, `weather-icon weather-icon--sm weather-icon--tone-${meta.tone}`));
  }

  return head;
}

function selectButton(city, onSelectCity) {
  const button = createEl('button', {
    className: 'link-arrow',
    attrs: { type: 'button', 'aria-label': t('cities.viewAria', { city: city.name }) }
  });

  button.append(createEl('span', { text: t('cities.view') }));
  button.append(iconEl('arrow-right', 'icon icon--xs'));
  button.addEventListener('click', () => onSelectCity?.(city));

  return button;
}

function cityCard(item, { onRetryCity, onSelectCity }) {
  const { city, data } = item;

  if (item.status === 'error') {
    const card = createEl('article', { className: 'city-card city-card--error' });
    card.append(cityHead(city, null));
    card.append(
      stateBox({
        compact: true,
        variant: 'error',
        icon: 'alert-triangle',
        title: t('cities.failed'),
        text: item.error?.code === 'timeout' ? t('cities.failedTimeout') : t('cities.failedText'),
        actions: [actionButton(t('common.retry'), () => onRetryCity?.(city))]
      })
    );
    return card;
  }

  if (item.status === 'loading') {
    const card = createEl('article', { className: 'city-card' });
    card.append(cityHead(city, null));
    card.append(
      stateBox({
        compact: true,
        icon: 'retry',
        title: t('cities.retrying'),
        text: t('cities.retryingText')
      })
    );
    return card;
  }

  const current = data?.current;
  const meta = getWeatherMeta(current?.weatherCode, current?.isDay);
  const card = createEl('article', { className: 'city-card' });

  card.append(cityHead(city, data));

  const temp = createEl('p', { className: 'city-card__temp', text: formatNumber(current?.temperature, 0) });
  if (typeof current?.temperature === 'number') {
    temp.append(createEl('span', { text: '°C' }));
  }
  card.append(temp);

  card.append(
    createEl('p', {
      className: 'city-card__cond',
      text: current ? weatherLabel(meta) : t('cities.condUnavailable')
    })
  );

  const foot = createEl('div', { className: 'city-card__foot' });

  const rain = createEl('span');
  rain.append(createEl('span', { text: `${t('common.rain')} ` }));
  rain.append(
    createEl('strong', {
      text: typeof data?.daily?.[0]?.rainProbability === 'number'
        ? `${formatNumber(data.daily[0].rainProbability, 0)}%`
        : '—'
    })
  );
  foot.append(rain);

  const wind = createEl('span');
  wind.append(createEl('span', { text: `${t('common.wind')} ` }));
  wind.append(
    createEl('strong', {
      text: typeof current?.windSpeed === 'number'
        ? `${formatNumber(current.windSpeed, 0)} ${t('common.windUnit')}`
        : '—'
    })
  );
  foot.append(wind);

  if (data?.stale) foot.append(createEl('span', { text: t('common.savedLabel') }));

  foot.append(selectButton(city, onSelectCity));
  card.append(foot);

  return card;
}

function renderLoading() {
  setText(updatedEl(), '—');
  restoreSkeleton('cities');
}

function renderError(root, error, onRetryAll) {
  setText(updatedEl(), '—');
  root.className = 'grid-cities grid-cities--state';
  root.setAttribute('aria-busy', 'false');
  clear(root);

  root.append(
    stateBox({
      variant: 'error',
      icon: 'alert-triangle',
      title: t('cities.errorTitle'),
      text: error?.code === 'timeout' ? t('cities.errorTimeout') : t('cities.errorText'),
      actions: [actionButton(t('common.retry'), () => onRetryAll?.(), 'primary')]
    })
  );
}

function renderReady(root, slice, handlers) {
  const items = Array.isArray(slice.data) ? slice.data : [];

  if (!items.length) {
    renderError(root, slice.error, handlers.onRetryAll);
    return;
  }

  root.className = 'grid-cities';
  root.setAttribute('aria-busy', 'false');
  clear(root);

  for (const item of items) {
    root.append(cityCard(item, handlers));
  }

  const firstOk = items.find((item) => item.status === 'ok' && item.data);
  const timezone = firstOk?.data?.timezone;
  setText(updatedEl(), slice.updatedAt ? formatUpdated(slice.updatedAt, timezone) : '—');
}

/**
 * @param {{
 *   onRetryCity?: (city: object) => void,
 *   onRetryAll?: () => void,
 *   onSelectCity?: (city: object) => void
 * }} [handlers]
 */
export function initCities({ onRetryCity, onRetryAll, onSelectCity } = {}) {
  if (!rootEl()) return;

  const handlers = { onRetryCity, onRetryAll, onSelectCity };

  const render = () => {
    const root = rootEl();
    if (!root) return;

    const slice = store.select('cities');

    switch (slice.status) {
      case 'loading':
        setRegionBusy('cities', true);
        renderLoading();
        break;
      case 'ready':
        renderReady(root, slice, handlers);
        break;
      case 'error':
        renderError(root, slice.error, onRetryAll);
        break;
      default:
        renderLoading();
    }
  };

  store.subscribe('cities', render);
  store.subscribe('meta', render);
}
