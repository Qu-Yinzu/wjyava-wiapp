/**
 * ui/feedback.js
 * Toast notifications and a polite screen-reader announcer.
 * Phase 1 keeps this dependency-free; Phase 3 may swap the toast for
 * Bootstrap's Toast instance.
 */

import { qs, createEl, iconEl, setText } from '../core/dom.js';

const MAX_VISIBLE_TOASTS = 2;

/**
 * @param {string} message plain text only (never HTML)
 * @param {{ tone?: 'info'|'warn', timeout?: number }} [options]
 */
export function showToast(message, { tone = 'info', timeout = 6500 } = {}) {
  const stack = qs('[data-toast-stack]');
  if (!stack) return;

  while (stack.children.length >= MAX_VISIBLE_TOASTS) {
    stack.firstElementChild?.remove();
  }

  const toast = createEl('div', {
    className: 'toast-wj',
    attrs: { 'data-tone': tone }
  });

  toast.append(iconEl(tone === 'warn' ? 'alert-triangle' : 'info', 'icon'));
  toast.append(createEl('p', { className: 'toast-wj__text', text: message }));

  const close = createEl('button', {
    className: 'toast-wj__close',
    attrs: { type: 'button', 'aria-label': 'Tutup notifikasi' },
    children: [iconEl('close', 'icon')]
  });

  close.addEventListener('click', () => toast.remove());
  toast.append(close);

  stack.append(toast);

  const timer = window.setTimeout(() => toast.remove(), timeout);
  toast.addEventListener('click', () => window.clearTimeout(timer), { once: true });
}

export function announce(message) {
  setText(qs('[data-announcer]'), message);
}
