/**
 * ui/faq.js
 * Bootstrap accordion with the WAI-ARIA accordion keyboard pattern:
 * Up/Down move between headers, Home/End jump to the first/last header.
 * Bootstrap itself owns open/close state and aria-expanded.
 */

import { qs, qsa } from '../core/dom.js';

export function initFaq() {
  const accordion = qs('#faqAccordion');
  if (!accordion) return;

  const buttons = qsa('.accordion-button', accordion);
  if (!buttons.length) return;

  // Bootstrap updates aria-expanded on click; this keeps it correct even if a
  // scripted toggle is triggered elsewhere.
  const sync = (event) => {
    const body = event.target;
    const button = body?.previousElementSibling?.querySelector('.accordion-button')
      || document.querySelector(`[data-bs-target="#${body?.id}"]`);
    if (button && body?.classList.contains('collapse')) {
      button.setAttribute('aria-expanded', String(event.type === 'show'));
    }
  };

  accordion.addEventListener('show.bs.collapse', sync);
  accordion.addEventListener('hide.bs.collapse', sync);

  accordion.addEventListener('keydown', (event) => {
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;

    let next = -1;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;

    event.preventDefault();
    buttons[next].focus();
  });
}
