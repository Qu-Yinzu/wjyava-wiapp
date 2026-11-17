/**
 * core/dom.js
 * Small, framework-free DOM helpers. External data must always go through
 * textContent / createEl({ text }) — never innerHTML.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE_URL = new URL('../../img/sprite-weather.svg', import.meta.url).href;

export const qs = (selector, root = document) => root.querySelector(selector);

export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string|number|null>, children?: Node[] }} [options]
 */
export function createEl(tag, options = {}) {
  const el = document.createElement(tag);

  if (options.className) el.className = options.className;

  if (options.text !== undefined && options.text !== null) {
    el.textContent = String(options.text);
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== null && value !== undefined) el.setAttribute(name, String(value));
    }
  }

  if (options.children && options.children.length) {
    el.append(...options.children.filter(Boolean));
  }

  return el;
}

/** Safe text setter for anything that originates outside our own markup. */
export function setText(el, value) {
  if (!el) return;
  el.textContent = value === null || value === undefined ? '' : String(value);
}

export function clear(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

export function toggleClass(el, name, force) {
  if (!el) return;
  el.classList.toggle(name, force);
}

/**
 * Add a listener and return an unsubscribe function.
 */
export function on(target, type, handler, options) {
  if (!target) return () => {};
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/**
 * Build an <svg><use href="sprite.svg#name"></use></svg> node.
 * Decorative by default; pass a label to make it meaningful.
 */
export function iconEl(name, className = 'icon', label = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);

  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${SPRITE_URL}#${name}`);
  svg.append(use);

  return svg;
}
