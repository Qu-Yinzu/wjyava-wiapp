/**
 * ui/skeleton.js
 * Captures the server-rendered skeleton nodes once at boot and can restore
 * them without innerHTML. Heights are identical to the final content, so
 * loading → data keeps CLS at zero.
 */

import { qs } from '../core/dom.js';

const REGIONS = ['current', 'forecast', 'cities', 'alerts', 'quake'];
const snapshots = new Map();

function regionEl(name) {
  return qs(`[data-region="${name}"]`);
}

export function captureSkeletons() {
  for (const name of REGIONS) {
    const el = regionEl(name);
    if (!el || snapshots.has(name)) continue;

    snapshots.set(name, {
      className: el.className,
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      nodes: Array.from(el.childNodes).map((node) => node.cloneNode(true))
    });
  }
}

/**
 * @param {string} name
 * @param {{ busy?: boolean }} [options]
 */
export function restoreSkeleton(name, { busy = true } = {}) {
  const el = regionEl(name);
  const snapshot = snapshots.get(name);
  if (!el || !snapshot) return;

  el.className = snapshot.className;
  if (snapshot.role) el.setAttribute('role', snapshot.role);
  if (snapshot.ariaLabel) el.setAttribute('aria-label', snapshot.ariaLabel);
  el.setAttribute('aria-busy', busy ? 'true' : 'false');

  while (el.firstChild) el.removeChild(el.firstChild);
  for (const node of snapshot.nodes) el.append(node.cloneNode(true));
}

export function setRegionBusy(name, busy) {
  const el = regionEl(name);
  if (el) el.setAttribute('aria-busy', busy ? 'true' : 'false');
}
