/**
 * ui/preloader.js
 * First-paint weather preloader.
 *
 * One overlay per document: it advances through the three weather stages,
 * fills the progress bar, then fades out once the initial weather boot has
 * settled (or when the safety timeout expires). City, locale and theme
 * changes never create another instance because the element is removed after
 * the first run.
 */

const MIN_VISIBLE_MS = 1800;
const MAX_VISIBLE_MS = 3400;
const PROGRESS_MS = 1800;
const FILL_SETTLE_MS = 180;
const EXIT_MS = 380;

let singleton = null;

/**
 * @param {{ minVisible?: number, maxVisible?: number, progressDuration?: number }} [options]
 */
export function initPreloader(options = {}) {
  if (singleton) return singleton;
  singleton = createPreloader(options);
  return singleton;
}

function createNoopPreloader() {
  return {
    get active() {
      return false;
    },
    complete() {},
    destroy() {}
  };
}

function createPreloader({
  minVisible = MIN_VISIBLE_MS,
  maxVisible = MAX_VISIBLE_MS,
  progressDuration = PROGRESS_MS
} = {}) {
  const root = document.getElementById('preloader');
  if (!root) return createNoopPreloader();

  const progressBar = root.querySelector('[role="progressbar"]');
  const startedAt = now();
  let progressValue = -1;
  let stageValue = 1;
  let active = true;
  let closing = false;
  let rafId = 0;
  let fallbackId = 0;
  let finishId = 0;
  let exitId = 0;

  root.dataset.stage = '1';
  setProgress(0);

  rafId = window.requestAnimationFrame(tick);
  fallbackId = window.setTimeout(() => complete(), maxVisible);

  const onPageShow = (event) => {
    if (event.persisted) destroy();
  };
  window.addEventListener('pageshow', onPageShow);

  function tick(frameTime) {
    rafId = 0;
    if (!active) return;

    const ratio = Math.min(Math.max(frameTime - startedAt, 0) / progressDuration, 1);
    setProgress(ratio * 100);
    setStage(ratio >= 2 / 3 ? 3 : ratio >= 1 / 3 ? 2 : 1);

    if (ratio < 1) rafId = window.requestAnimationFrame(tick);
  }

  function setProgress(value) {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    if (next === progressValue) return;

    progressValue = next;
    root.style.setProperty('--preloader-progress', String(next / 100));
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(next));
  }

  function setStage(next) {
    if (next === stageValue) return;
    stageValue = next;
    root.dataset.stage = String(next);
  }

  function complete() {
    if (!active || closing) return;
    closing = true;

    // Keep the progress loop running: a warm cache can settle the first
    // weather request before the first animation frame, and the three weather
    // stages still need their full minimum display window.
    const wait = Math.max(0, minVisible - (now() - startedAt));
    finishId = window.setTimeout(beginExit, wait);
  }

  function beginExit() {
    if (!active) return;

    setProgress(100);
    setStage(3);

    exitId = window.setTimeout(() => {
      if (!active) return;

      root.classList.add('is-leaving');
      root.setAttribute('aria-busy', 'false');
      root.setAttribute('aria-hidden', 'true');
      window.clearTimeout(fallbackId);

      finishId = window.setTimeout(destroy, EXIT_MS);
    }, FILL_SETTLE_MS);
  }

  function destroy() {
    if (!active) return;
    active = false;

    cancelAnimationFrame(rafId);
    window.clearTimeout(fallbackId);
    window.clearTimeout(finishId);
    window.clearTimeout(exitId);
    window.removeEventListener('pageshow', onPageShow);

    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return {
    get active() {
      return active;
    },
    complete,
    destroy
  };
}

function now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}
