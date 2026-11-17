/**
 * ui/search.js
 * Debounced autocomplete with keyboard navigation, request-id race guard,
 * and a clean "not found" state offering three nearby static suggestions.
 */

import { qs, qsa, createEl, clear } from '../core/dom.js';
import { store } from '../core/store.js';
import { SEARCH } from '../config.js';
import { t } from '../i18n/i18n.js';
import { issueRequestId, isLatestRequest, isAbortError } from '../core/http.js';
import { searchCities, suggestCities, findStaticCity } from '../services/geocoding.service.js';

const REQUEST_GROUP = 'search';

export function initSearch({ onSelect } = {}) {
  const form = qs('[data-search-form]');
  const input = qs('#city-input');
  const list = qs('#search-results');
  const hint = qs('[data-search-hint]');
  if (!form || !input || !list) return;

  let results = [];
  let activeIndex = -1;
  let mode = 'results';
  let open = false;
  let debounceTimer = 0;
  let controller = null;

  function syncSearch(patch) {
    store.set('search', patch);
  }

  function setHint(text, tone = '') {
    if (!hint) return;
    hint.textContent = text;
    if (tone) hint.dataset.tone = tone;
    else delete hint.dataset.tone;
  }

  function renderOptions() {
    clear(list);

    if (mode === 'suggestions' && results.length) {
      list.append(
        createEl('li', {
          className: 'search-results__label',
          text: t('search.suggestionsLabel'),
          attrs: { role: 'presentation' }
        })
      );
    }

    results.forEach((item, index) => {
      const option = createEl('li', {
        className: 'search-results__option',
        attrs: {
          id: `search-option-${index}`,
          role: 'option',
          'aria-selected': String(index === activeIndex),
          'data-index': index
        }
      });

      const body = createEl('span', { className: 'search-results__body' });
      body.append(createEl('span', { className: 'search-results__name', text: item.name }));

      const meta = [item.admin1, item.country].filter(Boolean).join(', ');
      if (meta) body.append(createEl('span', { className: 'search-results__meta', text: meta }));

      option.append(body);

      if (item.countryCode === 'ID') {
        option.append(createEl('span', { className: 'search-results__flag', text: 'ID' }));
      }

      list.append(option);
    });
  }

  function setActive(index) {
    activeIndex = index;
    const options = qsa('[data-index]', list);

    for (const option of options) {
      const isActive = Number(option.dataset.index) === index;
      option.setAttribute('aria-selected', String(isActive));
      if (isActive) option.scrollIntoView({ block: 'nearest' });
    }

    if (index >= 0) input.setAttribute('aria-activedescendant', `search-option-${index}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function openList() {
    if (!results.length) return;
    list.hidden = false;
    open = true;
    input.setAttribute('aria-expanded', 'true');
    syncSearch({ open: true });
  }

  function close({ forget = false } = {}) {
    list.hidden = true;
    open = false;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    if (forget) {
      results = [];
      mode = 'results';
      clear(list);
    }
    syncSearch({ open: false });
  }

  function selectResult(index, source) {
    const item = results[index];
    if (!item) return;

    input.value = item.name;
    close();
    setHint(t('search.selected', { city: item.name }));
    syncSearch({
      query: item.name,
      status: 'selected',
      results: [],
      suggestions: [],
      error: null,
      open: false
    });

    onSelect?.({ ...item, source });
  }

  function showSuggestions(query) {
    results = suggestCities(query, { limit: 3 });
    mode = 'suggestions';
    activeIndex = results.length ? 0 : -1;
    renderOptions();

    if (results.length) {
      openList();
      setActive(activeIndex);
      setHint(
        t('search.notFoundSuggest', { query, count: results.length }),
        'error'
      );
    } else {
      close();
      setHint(t('search.notFound', { query }), 'error');
    }

    syncSearch({
      status: 'empty',
      results: [],
      suggestions: results,
      error: null,
      open: results.length > 0
    });
  }

  async function runSearch(query, { selectFirst = false } = {}) {
    window.clearTimeout(debounceTimer);
    debounceTimer = 0;

    controller?.abort();
    controller = new AbortController();

    const requestId = issueRequestId(REQUEST_GROUP);
    setHint(t('search.searching'));
    syncSearch({ status: 'loading', query, error: null });

    try {
      const found = await searchCities(query, { signal: controller.signal });
      if (!isLatestRequest(REQUEST_GROUP, requestId)) return;

      if (!found.length) {
        showSuggestions(query);
        return;
      }

      results = found;
      mode = 'results';
      activeIndex = -1;
      renderOptions();
      openList();
      setHint(t('search.results', { count: found.length, query }));

      syncSearch({
        status: 'ready',
        results: found,
        suggestions: [],
        error: null,
        open: true
      });

      if (selectFirst) selectResult(0, 'search');
    } catch (error) {
      if (isAbortError(error) || !isLatestRequest(REQUEST_GROUP, requestId)) return;

      results = [];
      mode = 'results';
      close({ forget: true });
      setHint(t('search.failed'), 'error');
      syncSearch({
        status: 'error',
        results: [],
        suggestions: [],
        error: t('search.failed'),
        open: false
      });
    }
  }

  function scheduleSearch() {
    const query = input.value.trim();
    window.clearTimeout(debounceTimer);

    if (query.length < SEARCH.minChars) {
      controller?.abort();
      close({ forget: true });
      setHint(t('hero.searchHint'));
      syncSearch({
        query,
        status: 'idle',
        results: [],
        suggestions: [],
        error: null,
        open: false
      });
      return;
    }

    // Drop results from the previous keystroke so Enter can never select stale data.
    results = [];
    mode = 'results';
    close({ forget: true });
    setHint(t('search.searching'));
    syncSearch({ query, status: 'loading', results: [], suggestions: [], error: null, open: false });

    debounceTimer = window.setTimeout(() => runSearch(query), SEARCH.debounce);
  }

  input.addEventListener('input', scheduleSearch);

  input.addEventListener('focus', () => {
    if (results.length) openList();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      // Handle Enter explicitly so keyboard selection works even when the
      // browser does not treat the synthetic/IME key as a form submit.
      event.preventDefault();

      if (open && activeIndex >= 0) {
        selectResult(activeIndex, mode === 'suggestions' ? 'suggestion' : 'search');
        return;
      }

      if (open && mode === 'results' && results.length) {
        selectResult(0, 'search');
        return;
      }

      form.requestSubmit();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!results.length) return;
      if (!open) openList();
      const next = activeIndex < 0 ? 0 : (activeIndex + 1) % results.length;
      setActive(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) return;
      if (!open) openList();
      const previous = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
      setActive(previous);
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }

    if (event.key === 'Tab') {
      close();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    window.clearTimeout(debounceTimer);

    const query = input.value.trim();
    if (query.length < SEARCH.minChars) {
      setHint(t('search.short'), 'error');
      input.focus();
      return;
    }

    if (open && activeIndex >= 0) {
      selectResult(activeIndex, mode === 'suggestions' ? 'suggestion' : 'search');
      return;
    }

    if (open && mode === 'results' && results.length) {
      selectResult(0, 'search');
      return;
    }

    runSearch(query, { selectFirst: true });
  });

  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-index]');
    if (!option) return;
    const index = Number(option.dataset.index);
    selectResult(index, mode === 'suggestions' ? 'suggestion' : 'search');
  });

  document.addEventListener('pointerdown', (event) => {
    if (!form.contains(event.target)) close();
  });

  for (const chip of qsa('[data-quick-city]')) {
    chip.addEventListener('click', () => {
      const city = findStaticCity(chip.dataset.quickCity);
      if (!city) return;
      input.value = city.name;
      close({ forget: true });
      setHint(t('search.selected', { city: city.name }));
      syncSearch({
        query: city.name,
        status: 'selected',
        results: [],
        suggestions: [],
        error: null,
        open: false
      });
      onSelect?.(city);
    });
  }

  store.subscribe('meta', () => {
    if (input.value.trim().length < SEARCH.minChars) setHint(t('hero.searchHint'));
  });
}
