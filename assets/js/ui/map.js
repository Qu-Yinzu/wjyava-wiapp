/**
 * ui/map.js
 * Lazy Windy iframe (IntersectionObserver), debounced layer rebuilds,
 * and a 10-second load fallback. Subscribes only to `location` + `map`,
 * never to `weather`.
 */

import { qs, qsa, createEl, setText } from '../core/dom.js';
import { store } from '../core/store.js';
import { t } from '../i18n/i18n.js';
import { buildEmbedUrl, getOverlayMeta, normaliseOverlay } from '../services/windy.service.js';
import { formatCoordinate } from '../utils/format.js';
import { actionButton, stateBox } from './blocks.js';

const LOAD_TIMEOUT = 10_000;
const REBUILD_DEBOUNCE = 250;

export function initMap() {
  const frame = qs('[data-map-frame]');
  const stage = qs('[data-map-stage]');
  const placeholder = qs('[data-map-placeholder]');
  if (!frame || !stage) return;

  const coordsEl = qs('[data-map-coords]');
  const zoomEl = qs('[data-map-zoom]');
  const layerEl = qs('[data-map-layer-label]');
  const chips = qsa('[data-layer]', frame.parentElement || document);

  const legendTitle = qs('[data-legend-title]');
  const legendBar = qs('[data-legend-bar]');
  const legendMin = qs('[data-legend-min]');
  const legendMax = qs('[data-legend-max]');

  const placeholderBadge = placeholder?.querySelector('.badge');
  const placeholderTitle = placeholder?.querySelector('.map-placeholder__title');
  const placeholderText = placeholder?.querySelector('.map-placeholder__text');

  let iframe = null;
  let currentSrc = '';
  let status = 'idle';
  let mounted = false;
  let loadTimer = 0;
  let rebuildTimer = 0;
  let fallback = null;
  let observer = null;

  const location = () => store.select('location');
  const mapState = () => store.select('map');

  function setStatus(next) {
    status = next;
    frame.dataset.status = next;
    frame.setAttribute('aria-busy', next === 'loading' ? 'true' : 'false');
  }

  function updateLocationUI() {
    const loc = location();
    const map = mapState();

    if (coordsEl) {
      setText(coordsEl, `${formatCoordinate(loc.lat, 'lat')} · ${formatCoordinate(loc.lon, 'lon')}`);
    }
    if (zoomEl) setText(zoomEl, `z${Math.round(map.zoom) || 5}`);
  }

  function updateOverlayUI() {
    const map = mapState();
    const overlay = normaliseOverlay(map.overlay);
    const meta = getOverlayMeta(overlay);
    const loc = location();

    frame.dataset.overlay = overlay;
    frame.setAttribute('aria-label', t('map.frameAria', { layer: meta.label }));
    frame.setAttribute('role', 'group');

    for (const chip of chips) {
      chip.setAttribute('aria-pressed', String(chip.dataset.layer === overlay));
    }

    if (layerEl) setText(layerEl, t('map.activeLayer', { layer: meta.label }));
    if (legendTitle) setText(legendTitle, meta.title);
    if (legendMin) setText(legendMin, meta.minLabel);
    if (legendMax) setText(legendMax, meta.maxLabel);
    if (legendBar) {
      legendBar.style.background = meta.legend;
      legendBar.setAttribute('aria-label', t('map.ariaScale', { layer: meta.label }));
    }

    if (iframe) {
      iframe.setAttribute('title', t('map.iframeTitle', { layer: meta.label, city: loc.name }));
    }
  }

  function setPlaceholder({ badge = '', title = '', text = '' }) {
    if (!placeholder) return;
    if (placeholderBadge && badge) setText(placeholderBadge, badge);
    if (placeholderTitle && title) setText(placeholderTitle, title);
    if (placeholderText && text) setText(placeholderText, text);
  }

  function removeFallback() {
    if (fallback) {
      fallback.remove();
      fallback = null;
    }
  }

  function showFallback() {
    if (fallback) return;

    fallback = createEl('div', { className: 'map-fallback' });
    fallback.append(
      stateBox({
        variant: 'error',
        icon: 'alert-triangle',
        title: t('map.failedTitle'),
        text: t('map.failedText'),
        actions: [
          actionButton(t('map.reload'), retryMap, 'primary'),
          createEl('a', {
            className: 'btn btn--soft btn--sm',
            text: t('map.openWindy'),
            attrs: { href: 'https://www.windy.com', target: '_blank', rel: 'noopener noreferrer' }
          })
        ]
      })
    );

    frame.append(fallback);
    setStatus('failed');
  }

  function startLoadTimer() {
    window.clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
      if (status === 'loading') showFallback();
    }, LOAD_TIMEOUT);
  }

  function handleLoad() {
    window.clearTimeout(loadTimer);
    removeFallback();
    setStatus('ready');
    if (placeholder) placeholder.hidden = true;
  }

  function buildSrc() {
    const loc = location();
    const map = mapState();
    return buildEmbedUrl({
      lat: loc.lat,
      lon: loc.lon,
      zoom: map.zoom,
      overlay: map.overlay
    });
  }

  function ensureIframe() {
    const src = buildSrc();
    removeFallback();

    if (!iframe) {
      iframe = createEl('iframe', {
        className: 'map-iframe',
        attrs: {
          title: t('map.iframeTitle', {
            layer: getOverlayMeta(mapState().overlay).label,
            city: location().name
          }),
          src,
          loading: 'lazy',
          allow: 'fullscreen',
          referrerpolicy: 'no-referrer-when-downgrade'
        }
      });
      iframe.addEventListener('load', handleLoad);
      stage.append(iframe);
      currentSrc = src;
      setPlaceholder({
        badge: t('map.loadingBadge'),
        title: t('map.loadingTitle'),
        text: t('map.loadingText')
      });
      if (placeholder) placeholder.hidden = false;
      setStatus('loading');
      startLoadTimer();
      return;
    }

    if (src === currentSrc) return;

    currentSrc = src;
    setStatus('loading');
    startLoadTimer();
    iframe.src = src;
  }

  function retryMap() {
    window.clearTimeout(loadTimer);
    removeFallback();
    if (placeholder) placeholder.hidden = false;
    setPlaceholder({
      badge: t('map.loadingBadge'),
      title: t('map.retryTitle'),
      text: t('map.retryText')
    });

    if (iframe) {
      iframe.remove();
      iframe = null;
    }
    currentSrc = '';
    setStatus('idle');
    ensureIframe();
  }

  function scheduleRebuild() {
    if (status === 'idle') return;
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(ensureIframe, REBUILD_DEBOUNCE);
  }

  function mountWhenVisible() {
    if (mounted) return;
    mounted = true;
    ensureIframe();
  }

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const overlay = normaliseOverlay(chip.dataset.layer);
      if (store.select('map').overlay === overlay) return;
      store.set('map', { overlay });
    });
  }

  updateLocationUI();
  updateOverlayUI();

  store.subscribe('location', () => {
    updateLocationUI();
    scheduleRebuild();
  });

  store.subscribe('map', () => {
    updateLocationUI();
    updateOverlayUI();
    scheduleRebuild();
  });

  store.subscribe('meta', () => {
    updateOverlayUI();
    if (status === 'loading') {
      setPlaceholder({
        badge: t('map.loadingBadge'),
        title: t('map.loadingTitle'),
        text: t('map.loadingText')
      });
    }
  });

  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          observer = null;
          mountWhenVisible();
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 }
    );
    observer.observe(frame);
  } else {
    mountWhenVisible();
  }
}
