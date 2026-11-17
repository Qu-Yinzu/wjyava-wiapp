/**
 * ui/quake.js
 * National BMKG earthquake panel. BMKG strings (region, potential, felt,
 * date, time) are shown verbatim; only labels and local-time formatting are
 * localised. No distance-based "relevance" is ever calculated.
 */

import { qs, createEl, clear } from '../core/dom.js';
import { store } from '../core/store.js';
import { DEFAULT_TIMEZONE } from '../config.js';
import { t } from '../i18n/i18n.js';
import { formatDateTime, formatNumber } from '../utils/format.js';
import { badge, panelHead, panelFoot, sourceLine, stateBox, linkArrow, actionButton } from './blocks.js';
import { restoreSkeleton, setRegionBusy } from './skeleton.js';

function rootEl() {
  return qs('[data-region="quake"]');
}

function shell(root) {
  root.className = 'panel quake-panel';
  root.setAttribute('aria-busy', 'false');
  clear(root);
}

function renderLoading() {
  setRegionBusy('quake', true);
  restoreSkeleton('quake');
}

function row(label, value, secondary = '') {
  const wrap = createEl('div', { className: 'quake-row' });
  wrap.append(createEl('dt', { text: label }));

  const dd = createEl('dd');
  dd.append(createEl('span', { text: value || '—' }));

  if (secondary) {
    dd.append(createEl('span', { className: 'quake-row__secondary', text: secondary }));
  }

  wrap.append(dd);
  return wrap;
}

function header(data) {
  const badges = [badge(t('common.national'), 'national')];
  if (data?.stale) badges.push(badge(t('quake.staleBadge'), 'caution'));

  return panelHead({
    title: t('quake.title'),
    subtitle: t('quake.subtitle'),
    badges
  });
}

function renderState(root, { variant = 'neutral', title, text, onRetry }) {
  shell(root);
  root.append(header(null));

  const body = createEl('div', { className: 'panel__body' });
  const actions = [];

  if (onRetry) actions.push(actionButton(t('common.retry'), onRetry, 'primary'));
  actions.push(linkArrow(t('common.openBmkgQuake'), 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg'));

  body.append(
    stateBox({
      variant,
      icon: variant === 'error' ? 'alert-triangle' : 'quake',
      title,
      text,
      actions
    })
  );

  root.append(body);
  root.append(panelFoot([sourceLine(t('quake.source', { time: t('common.na') }))]));
}

function renderReady(root, data, onRetry) {
  if (!data) {
    renderState(root, {
      variant: 'empty',
      title: t('quake.emptyTitle'),
      text: t('quake.emptyText'),
      onRetry
    });
    return;
  }

  shell(root);
  root.append(header(data));

  const body = createEl('div', { className: 'panel__body' });

  const hero = createEl('div', { className: 'quake-panel__hero' });
  const magnitude = Number.isFinite(data.magnitude)
    ? formatNumber(data.magnitude, 1)
    : data.magnitudeText || '—';

  hero.append(createEl('span', { className: 'quake-panel__mag', text: magnitude }));
  hero.append(createEl('span', { className: 'quake-panel__unit', text: 'M' }));
  body.append(hero);

  body.append(createEl('p', { className: 'quake-panel__region', text: data.region }));

  if (data.fallback) {
    body.append(createEl('p', { className: 'quake-note', text: t('quake.fallbackNote') }));
  }

  const rows = createEl('dl', { className: 'quake-rows' });

  const bmkgTime = [data.dateText, data.timeText].filter(Boolean).join(' · ');
  const localTime = data.dateTime
    ? t('quake.localTime', { time: formatDateTime(data.dateTime, DEFAULT_TIMEZONE) })
    : '';

  rows.append(row(t('quake.depth'), data.depth, ''));
  rows.append(row(t('quake.time'), bmkgTime || t('common.na'), localTime));
  rows.append(row(t('quake.potential'), data.potential || t('common.na')));

  if (data.felt && data.felt !== '-') {
    rows.append(row(t('quake.felt'), data.felt));
  }

  body.append(rows);

  const links = createEl('div', { className: 'quake-links' });
  links.append(linkArrow(t('common.openBmkgQuake'), data.url || 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg'));

  if (data.shakemapUrl) {
    links.append(linkArrow(t('quake.shakemap'), data.shakemapUrl));
  }

  body.append(links);
  root.append(body);

  const time = data.updatedAt
    ? formatDateTime(data.updatedAt, DEFAULT_TIMEZONE)
    : t('common.na');

  const right = [badge(t('quake.magnitude'), 'neutral')];
  if (Number.isFinite(data.magnitude)) {
    right.unshift(badge(`M ${formatNumber(data.magnitude, 1)}`, 'warning'));
  }

  root.append(
    panelFoot(
      [sourceLine(t('quake.source', { time }), { href: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg', external: true })],
      right
    )
  );
}

function renderError(root, error, onRetry) {
  renderState(root, {
    variant: 'error',
    title: t('quake.errorTitle'),
    text: error?.message || t('quake.errorText'),
    onRetry
  });
}

/**
 * @param {{ onRetry?: () => void }} [options]
 */
export function initQuake({ onRetry } = {}) {
  if (!rootEl()) return;

  const render = () => {
    const root = rootEl();
    if (!root) return;

    const slice = store.select('quake');

    if (slice.status === 'loading' || slice.status === 'placeholder') {
      renderLoading();
      return;
    }

    if (slice.status === 'error') {
      renderError(root, slice.error, onRetry);
      return;
    }

    renderReady(root, slice.data, onRetry);
  };

  store.subscribe('quake', render);
  store.subscribe('meta', render);
}
