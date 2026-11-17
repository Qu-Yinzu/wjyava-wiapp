/**
 * core/router.js
 * ScrollSpy with IntersectionObserver, accessible section highlighting,
 * smooth in-page navigation (CSS), and mobile menu close-on-click.
 */

import { qs, qsa } from '../core/dom.js';
import { store } from '../core/store.js';

/** Sections without their own nav item highlight the closest parent item. */
const NAV_BY_SECTION = Object.freeze({
  cuaca: 'cuaca',
  prakiraan: 'cuaca',
  peta: 'peta',
  kota: 'peta',
  peringatan: 'peringatan',
  tentang: 'tentang'
});

const OBSERVED_SECTIONS = ['cuaca', 'prakiraan', 'peta', 'kota', 'peringatan', 'tentang'];

function closeMobileMenu() {
  const menu = qs('#navMenu');
  if (!menu?.classList.contains('show')) return;
  if (window.bootstrap?.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(menu, { toggle: false }).hide();
  }
}

export function initRouter() {
  const links = qsa('.nav-link-wj');
  if (!links.length) return;

  const linkByTarget = new Map();
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) linkByTarget.set(href.slice(1), link);
  }

  let active = '';

  function setActive(sectionId) {
    const navId = NAV_BY_SECTION[sectionId];
    const link = navId ? linkByTarget.get(navId) : null;
    if (!link || navId === active) return;

    active = navId;

    for (const item of links) {
      const isActive = item === link;
      item.classList.toggle('is-active', isActive);
      if (isActive) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    }

    store.set('ui', { activeSection: navId });
  }

  for (const link of links) {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) setActive(href.slice(1));
      closeMobileMenu();
    });
  }

  const hash = window.location.hash.replace('#', '');
  if (hash && NAV_BY_SECTION[hash]) setActive(hash);
  else setActive('cuaca');

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        setActive(entry.target.id);
      }
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );

  for (const id of OBSERVED_SECTIONS) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}
