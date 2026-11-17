/**
 * ui/alerts.js
 * National BMKG early-warning panel. Text from BMKG is rendered verbatim with
 * textContent only. The colour accent is derived from the official CAP
 * severity; the severity word itself is always shown.
 */

import { qs, createEl, clear } from '../core/dom.js';
import { store } from '../core/store.js';
import { PROXY_BASE } from '../config.js';
import { t } from '../i18n/i18n.js';
import { formatAlertDateTime, formatDateTime } from '../utils/format.js';
import { regionMatches } from '../utils/text.js';
import { badge, panelHead, panelFoot, sourceLine, stateBox, linkArrow, actionButton } from './blocks.js';
import { restoreSkeleton, setRegionBusy } from './skeleton.js';

const SEVERITY_VARIANT = Object.freeze({
  critical: 'critical',
  warning: 'warning',
  caution: 'caution',
  unknown: 'neutral'
});

function rootEl() {
  return qs('[data-region="alerts"]');
}

function shell(root) {
  root.className = 'panel panel--alerts';
  root.setAttribute('aria-busy', 'false');
  clear(root);
}

function renderLoading() {
  setRegionBusy('alerts', true);
  restoreSkeleton('alerts');
}

function severityVariant(level) {
  return SEVERITY_VARIANT[level] || 'neutral';
}

function placeLabel(location) {
  if (!location) return t('common.location');
  return [location.name, location.country].filter(Boolean).join(', ');
}

function foreignNote(location) {
  if (!location?.countryCode || location.countryCode === 'ID') return null;

  const note = createEl('p', { className: 'info-note alert-scope-note' });
  note.append(
    createEl('span', {
      text: t('alerts.foreignNote', { place: placeLabel(location) })
    })
  );
  return note;
}

function metaPair(label, value) {
  const row = createEl('span', { className: 'meta-inline' });
  row.append(createEl('span', { className: 'meta-inline__label', text: label }));
  row.append(createEl('span', { text: value || '—' }));
  return row;
}

function alertItem(item, location) {
  const level = item.level || 'unknown';
  const li = createEl('li', {
    className: 'alert-item',
    attrs: { 'data-level': level }
  });

  const top = createEl('div', { className: 'alert-item__top' });
  top.append(
    createEl('span', {
      className: 'alert-item__time',
      text: item.publishedAt ? formatDateTime(item.publishedAt, 'Asia/Jakarta') : '—'
    })
  );
  top.append(badge(item.severity || t('alerts.levelUnknown'), severityVariant(level)));
  li.append(top);

  li.append(
    createEl('h4', {
      className: 'alert-item__headline',
      text: item.headline || item.event || t('alerts.levelUnknown')
    })
  );

  if (item.event && item.event !== item.headline) {
    li.append(createEl('p', { className: 'alert-item__event', text: item.event }));
  }

  const meta = createEl('p', { className: 'alert-item__meta' });
  meta.append(metaPair(t('alerts.area'), item.area || '—'));
  meta.append(
    metaPair(
      t('alerts.expires'),
      item.expires ? formatAlertDateTime(item.expires) : '—'
    )
  );
  li.append(meta);

  if (item.detailStatus !== 'ok' && item.description) {
    li.append(createEl('p', { className: 'alert-item__desc', text: item.description }));
  }

  const foot = createEl('div', { className: 'alert-item__foot' });
  const notes = createEl('div', { className: 'panel__badges' });

  if (regionMatches(item.area, location?.admin1)) {
    notes.append(badge(t('alerts.relevant'), 'relevance'));
  }

  if (item.detailStatus !== 'ok') {
    const note = badge(t('alerts.detailUnavailable'), 'neutral');
    note.classList.add('badge--wrap');
    notes.append(note);
  }

  if (notes.childNodes.length) foot.append(notes);

  if (item.url) {
    foot.append(linkArrow(t('alerts.openCap'), item.url));
  }

  li.append(foot);
  return li;
}

function header(items, data) {
  const badges = [];
  if (items.length) badges.push(badge(t('alerts.count', { count: items.length }), 'national'));
  if (data?.stale) badges.push(badge(t('alerts.staleBadge'), 'caution'));

  return panelHead({
    title: t('alerts.title'),
    subtitle: t('alerts.subtitle'),
    badges
  });
}

function sourceNote(data) {
  const time = data?.updatedAt
    ? formatDateTime(data.updatedAt, 'Asia/Jakarta')
    : t('common.na');

  return sourceLine(
    data?.updatedAt ? t('alerts.source', { time }) : t('alerts.sourcePending'),
    { href: 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca.bmkg', external: true }
  );
}

function renderState(root, { variant = 'neutral', title, text, onRetry, footerBadge }) {
  shell(root);
  root.append(header([], null));

  const body = createEl('div', { className: 'panel__body' });
  const actions = [];

  if (onRetry) actions.push(actionButton(t('common.retry'), onRetry, 'primary'));
  actions.push(linkArrow(t('common.openBmkgAlerts'), 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca.bmkg'));

  body.append(
    stateBox({
      variant,
      icon: variant === 'error' ? 'alert-triangle' : 'shield',
      title,
      text,
      actions
    })
  );

  root.append(body);
  root.append(
    panelFoot(
      [sourceNote(null)],
      footerBadge ? [footerBadge] : []
    )
  );
}

function renderReady(root, data, location, onRetry) {
  shell(root);

  const items = Array.isArray(data?.items) ? data.items : [];
  root.append(header(items, data));

  const body = createEl('div', { className: 'panel__body' });
  const note = foreignNote(location);
  if (note) body.append(note);

  if (data?.stale) {
    body.append(
      createEl('p', {
        className: 'alert-stale-note',
        text: `${t('alerts.staleBadge')} · ${data.updatedAt ? formatDateTime(data.updatedAt, 'Asia/Jakarta') : '—'}`
      })
    );
  }

  if (!items.length) {
    body.append(
      stateBox({
        variant: 'empty',
        icon: 'shield',
        title: t('alerts.emptyTitle'),
        text: t('alerts.emptyText'),
        actions: [
          actionButton(t('common.retry'), () => onRetry?.()),
          linkArrow(t('common.openBmkgAlerts'), 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca.bmkg')
        ]
      })
    );
  } else {
    const list = createEl('ul', { className: 'alert-list', attrs: { 'aria-label': t('alerts.aria') } });
    for (const item of items) list.append(alertItem(item, location));
    body.append(list);
  }

  root.append(body);

  const right = [];
  if (data?.degraded) right.push(badge(t('alerts.proxyLabel'), 'neutral'));
  right.push(badge(t('common.national'), 'national'));

  root.append(panelFoot([sourceNote(data)], right));
}

function renderDegraded(root, slice, onRetry) {
  renderState(root, {
    variant: 'error',
    title: t('alerts.degradedTitle'),
    text: t('alerts.degradedText', { proxy: PROXY_BASE }),
    onRetry,
    footerBadge: badge(t('alerts.proxyLabel'), 'neutral')
  });

  // Keep the technical reason out of the main copy but available to developers.
  if (slice.error?.message) root.dataset.error = slice.error.message;
}

function renderError(root, error, onRetry) {
  renderState(root, {
    variant: 'error',
    title: t('alerts.errorTitle'),
    text: error?.message || t('alerts.errorText'),
    onRetry
  });
}

/**
 * @param {{ onRetry?: () => void }} [options]
 */
export function initAlerts({ onRetry } = {}) {
  if (!rootEl()) return;

  const render = () => {
    const root = rootEl();
    if (!root) return;

    const slice = store.select('alerts');
    const location = store.select('location');

    if (slice.status === 'loading' || slice.status === 'placeholder') {
      renderLoading();
      return;
    }

    if (slice.status === 'degraded') {
      renderDegraded(root, slice, onRetry);
      return;
    }

    if (slice.status === 'error') {
      renderError(root, slice.error, onRetry);
      return;
    }

    renderReady(root, slice.data, location, onRetry);
  };

  store.subscribe('alerts', render);
  store.subscribe('location', render);
  store.subscribe('meta', render);
}
