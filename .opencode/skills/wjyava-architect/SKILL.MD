name: wjyava-architect
description: Build, slice, and integrate WJYAVA Weather Intelligence Interface using static ES Modules (no bundler), Bootstrap 5 dark overrides, Open-Meteo API, Windy map embed, and BMKG proxy. Use whenever creating, editing, or debugging HTML, CSS, JavaScript modules, UI components, API services, or the Node proxy in WJYAVA.
compatibility: opencode
metadata:
project: wjyava
architecture: static-es-modules

WJYAVA Engineering & Architecture Skill

Follow PLAN.md at the project root as the single source of truth for roadmap phases, directory structure, and API contracts.

1. Non-Negotiable Technical Rules

No Bundler (Native ES Modules): Every relative import statement in JavaScript MUST include the explicit .js file extension (e.g., import { store } from './core/store.js';).

Scoped Rendering (Pub/Sub): Never re-render the entire page on state updates. Each UI module in assets/js/ui/ subscribes only to its own state slice so the Windy <iframe> does not reload unnecessarily.

Bootstrap 5 Usage: Load Bootstrap 5 via CDN with data-bs-theme="dark". Use it strictly for grid, navbar collapse, accordion, forms, and toasts. Override all colors and typography via custom CSS variables in assets/css/tokens.css and bootstrap-overrides.css.

XSS Prevention: Never inject external API strings (city names, BMKG warnings, earthquake regions) using innerHTML. Always use textContent or dom.js helpers. External links must include target="_blank" rel="noopener noreferrer".

Data Integrity & Attribution: Never fabricate weather or disaster predictions. Display BMKG warning texts (headline, description, areaDesc) verbatim. Every data panel must display its provider name (Open-Meteo, BMKG, Windy) and last updated timestamp.

2. Design System ("Dark Atmospheric Interface")

Color Tokens (assets/css/tokens.css):

Background (Deep Navy): #0B1020

Surface / Card (Dark Slate): #151C2E

Primary Accent (Indigo): #6366F1 (use #818CF8 for text on dark surfaces)

Weather Highlight (Mimosa): #F5D76E

Primary Text (Cloud White): #E2E8F0

Secondary Text: #94A3B8 (do not use #64748B for small body text due to WCAG contrast limits; reserve #64748B for borders and large uppercase labels)

Typography: Plus Jakarta Sans for headings (h1–h6), Inter for UI labels, body text, and numerical metrics.

Layout Stability (Zero CLS): Render static skeleton placeholders in index.html with fixed min-height matching final cards. Disable shimmer and smooth scroll when prefers-reduced-motion: reduce is active.

3. Directory & Module Map

index.html — Single-page layout with 8 semantic sections (Navbar, Hero + Current Weather, 5-Day Forecast, Weather Map, 5 Major Cities, Alerts & Quake, About/FAQ/Contact, Footer).

assets/css/ — tokens.css, base.css, layout.css, components.css, bootstrap-overrides.css, responsive.css.

assets/js/core/ — store.js (global state + pub/sub), http.js (fetch with AbortController, 8s timeout, 2x retry, dedupe, requestId), cache.js (localStorage TTL), dom.js, router.js (IntersectionObserver ScrollSpy).

assets/js/services/ — geocoding.service.js, forecast.service.js, bmkg.service.js, windy.service.js, geo.service.js.

assets/js/ui/ — Independent renderers (navbar.js, search.js, current-weather.js, forecast.js, cities.js, alerts.js, quake.js, map.js, faq.js, contact.js, skeleton.js, feedback.js).

assets/js/i18n/ — id.js, en.js, i18n.js.

assets/js/utils/ — weather-code.js (WMO mapping + is_day === 0 night icons), format.js (Intl timezone-aware), text.js, validate.js.

server/index.js — Optional 1-endpoint Express CORS proxy (GET /api/bmkg/alerts?lang=id|en) with strict BMKG URL whitelist, CAP detail aggregation, and 5-minute in-memory cache.

4. API & Integration Guidelines

Geocoding & Forecast (Open-Meteo): Prioritize country_code === 'ID' in search autocomplete (300ms debounce). Fetch the 5 Indonesian major cities (Jakarta, Surabaya, Bandung, Medan, Makassar) using Promise.allSettled so one failed city card does not break the others.

Windy Map Embed: Lazy-mount the <iframe> using IntersectionObserver. Debounce iframe.src updates by 250ms when coordinates or layer (wind, rain, temp, clouds) change.

BMKG Alerts & Earthquake: Fetch autogempa.json directly from data.bmkg.go.id. Fetch weather warnings via /api/bmkg/alerts (mapping badge colors strictly from official CAP severity). Always display national Indonesia alerts/quake info clearly labeled, even when the user searches for a foreign city. If the proxy is offline, render degraded mode with an official link to bmkg.go.id.

5. Step-by-Step Execution Protocol

Before coding a phase: Read the corresponding checklist and Definition of Done (DoD) in PLAN.md.

During Phase 0–1: Build semantic HTML, CSS design tokens, responsive layouts (360px–1440px), and skeleton/error states using a temporary mock-data.js.

During Phase 2–3: Replace mock-data.js with live services, remove temporary mock files, and test offline/error states.

Verification: Ensure zero console errors, proper aria-live / aria-busy attributes, and clean separation of concerns before marking a phase complete.