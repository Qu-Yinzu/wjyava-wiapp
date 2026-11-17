/**
 * ui/blocks.js
 * Shared, text-only DOM builders used by every panel.
 * No builder in this file ever accepts HTML strings.
 */

import { createEl, iconEl } from '../core/dom.js';

/**
 * @param {string} text
 * @param {'neutral'|'national'|'critical'|'warning'|'caution'|'ok'|'relevance'} [variant]
 */
export function badge(text, variant = 'neutral') {
  return createEl('span', { className: `badge badge--${variant}`, text });
}

/**
 * @param {{ title: string, subtitle?: string, badges?: Node[], extra?: Node }} options
 */
export function panelHead({ title, subtitle = '', badges = [], extra = null }) {
  const head = createEl('div', { className: 'panel__head' });
  const text = createEl('div', { className: 'sk-stack', attrs: { style: 'flex: 1' } });

  text.append(createEl('h3', { className: 'panel__title', text: title }));

  if (subtitle) {
    text.append(createEl('p', { className: 'panel__sub', text: subtitle }));
  }

  head.append(text);

  const aside = createEl('div', { className: 'panel__badges' });
  badges.filter(Boolean).forEach((node) => aside.append(node));
  if (extra) aside.append(extra);
  if (aside.childNodes.length) head.append(aside);

  return head;
}

/**
 * @param {string} text
 * @param {{ icon?: string, href?: string, external?: boolean }} [options]
 */
export function sourceLine(text, { icon = 'info', href = '', external = false } = {}) {
  const tag = href ? 'a' : 'p';
  const node = createEl(tag, {
    className: 'source-note',
    attrs: href
      ? {
          href,
          target: external ? '_blank' : null,
          rel: external ? 'noopener noreferrer' : null
        }
      : null
  });

  node.append(iconEl(icon, 'icon icon--xs'));
  node.append(createEl('span', { text }));

  return node;
}

/**
 * @param {string} label
 * @param {() => void} onClick
 * @param {'primary'|'soft'|'ghost'} [variant]
 */
export function actionButton(label, onClick, variant = 'soft') {
  const button = createEl('button', {
    className: `btn btn--${variant} btn--sm`,
    text: label,
    attrs: { type: 'button' }
  });

  if (typeof onClick === 'function') button.addEventListener('click', onClick);

  return button;
}

/**
 * @param {string} text
 * @param {string} href
 */
export function linkArrow(text, href) {
  const link = createEl('a', {
    className: 'link-arrow',
    attrs: {
      href,
      target: '_blank',
      rel: 'noopener noreferrer'
    }
  });

  link.append(createEl('span', { text }));
  link.append(iconEl('external', 'icon icon--xs'));

  return link;
}

/**
 * @param {{
 *   variant?: 'neutral'|'error'|'empty',
 *   icon?: string,
 *   title: string,
 *   text?: string,
 *   actions?: Node[],
 *   compact?: boolean
 * }} options
 */
export function stateBox({ variant = 'neutral', icon = 'info', title, text = '', actions = [], compact = false }) {
  const classes = ['state-box'];
  if (variant === 'error') classes.push('state-box--error');
  if (variant === 'empty') classes.push('state-box--empty');
  if (compact) classes.push('state-box--compact');

  const box = createEl('div', { className: classes.join(' ') });

  const iconWrap = createEl('div', { className: 'state-box__icon' });
  iconWrap.append(iconEl(icon, 'icon'));
  box.append(iconWrap);

  box.append(createEl('p', { className: 'state-box__title', text: title }));
  if (text) box.append(createEl('p', { className: 'state-box__text', text }));

  const usable = actions.filter(Boolean);
  if (usable.length) {
    const wrap = createEl('div', { className: 'state-box__actions' });
    usable.forEach((node) => wrap.append(node));
    box.append(wrap);
  }

  return box;
}

/**
 * @param {{ label: string, value: string, unit?: string, icon?: string, caution?: boolean }} options
 */
export function metric({ label, value, unit = '', icon = '', caution = false }) {
  const item = createEl('div', { className: caution ? 'metric metric--caution' : 'metric' });
  const labelNode = createEl('p', { className: 'metric__label' });

  if (icon) labelNode.append(iconEl(icon, 'icon icon--xs'));
  labelNode.append(createEl('span', { text: label }));

  const valueNode = createEl('p', { className: 'metric__value', text: value });
  if (unit) valueNode.append(createEl('small', { text: ` ${unit}` }));

  item.append(labelNode, valueNode);
  return item;
}

/**
 * @param {Node[]} left
 * @param {Node[]} right
 */
export function panelFoot(left = [], right = []) {
  const foot = createEl('div', { className: 'panel__foot' });
  const leftWrap = createEl('div', { className: 'panel__badges' });
  const rightWrap = createEl('div', { className: 'panel__badges' });

  left.filter(Boolean).forEach((node) => leftWrap.append(node));
  right.filter(Boolean).forEach((node) => rightWrap.append(node));

  if (leftWrap.childNodes.length) foot.append(leftWrap);
  if (rightWrap.childNodes.length) foot.append(rightWrap);

  return foot;
}
