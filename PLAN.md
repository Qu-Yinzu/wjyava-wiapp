# WJYAVA — Weather Intelligence Interface

## Rencana Implementasi Teknis (Single Source of Truth)

| Meta | Nilai |
|---|---|
| Proyek | WJYAVA — Weather Intelligence Interface |
| Root | `D:\Weather Web` |
| Versi dokumen | 1.1 (revisi: CAP parsing di proxy, konteks nasional BMKG, aturan import `.js`) |
| Tanggal | 16 November 2026 |
| Stack wajib | Semantic HTML5 · Custom CSS3 · Vanilla JS (ES6 Modules) · Bootstrap 5 (CDN) |
| Arsitektur | Static ES Modules, tanpa bundler |
| Status | Fase implementasi belum dimulai (dokumen ini = kontrak kerja) |

> Dokumen ini adalah **satu-satunya sumber kebenaran** untuk struktur folder, kontrak API, keputusan desain, dan urutan fase. Setiap perubahan arsitektur harus memperbarui dokumen ini lebih dulu.

---

## 0. Prinsip yang Tidak Bisa Ditawar

| # | Prinsip | Konsekuensi teknis |
|---|---|---|
| P1 | **Tanpa bundler, ES Modules native** | Setiap import relatif **wajib** berekstensi `.js`; tidak ada bare specifier; tidak ada import map |
| P2 | **Scoped rendering (pub/sub)** | Tidak boleh `renderAll()`; tiap modul UI subscribe ke slice state-nya sendiri agar `<iframe>` Windy tidak reload |
| P3 | **Bootstrap 5 hanya infrastruktur UI** | Dipakai untuk grid, navbar collapse, accordion, form, toast; warna & tipografi **selalu** dari `tokens.css` |
| P4 | **Anti-XSS** | Data eksternal (nama kota, teks BMKG, wilayah gempa) **tidak pernah** lewat `innerHTML`; hanya `textContent` / helper `dom.js` |
| P5 | **Integritas data** | Tidak memprediksi bencana; teks BMKG verbatim; setiap panel menampilkan **sumber** + **waktu pembaruan** |
| P6 | **Zero CLS** | Skeleton statis di `index.html` dengan `min-height` = tinggi kartu final |
| P7 | **Degradasi anggun** | Kegagalan satu sumber data tidak boleh menjatuhkan section lain; tidak ada data rekaan sebagai pengganti |
| P8 | **Konteks nasional** | Panel BMKG (peringatan dini & gempa) selalu berskala **Indonesia**, bahkan saat pengguna mencari kota luar negeri |

---

## 1. Kepatuhan Skill `wjyava-architect`

Skill proyek: `D:\Weather Web\.opencode\skills\wjyava-architect\SKILL.MD`.

| Aturan skill | Cara dipatuhi di proyek ini |
|---|---|
| Import relatif wajib `.js` | Bagian §3.2 (contoh + larangan) |
| Scoped rendering per slice | §7.1 (`store.subscribe` per modul) |
| Bootstrap 5 dark, override penuh | §5.3 |
| Anti-XSS | §9.3 |
| Atribusi & verbatim BMKG | §6.5, §6.6 |
| Struktur folder & modul | §2 |
| Kontrak API & CORS | §6 |
| Protokol eksekusi fase | §10 |

---

## 2. Struktur Direktori & File

```
D:\Weather Web\
├─ index.html                      # single-page, 8 section semantik
├─ PLAN.md                         # dokumen ini
├─ README.md                       # cara run (static + proxy), arsitektur, kredit data
├─ .gitignore                      # node_modules, .env, *.log
│
├─ assets/
│  ├─ css/
│  │  ├─ tokens.css                # :root variables (warna, spacing, radius, elevasi, tipografi)
│  │  ├─ base.css                  # reset ringan, body, scroll-behavior, focus-visible, skip-link
│  │  ├─ layout.css                # hero 2-col, alerts 7/5 asymmetric, section rhythm
│  │  ├─ components.css            # card, badge, skeleton, alert-panel, metric-row, faq, form, toast
│  │  ├─ bootstrap-overrides.css   # map token → --bs-*, navbar, accordion, form-control, toast
│  │  └─ responsive.css            # <576, <768, <992, <1200
│  │
│  ├─ js/
│  │  ├─ main.js                   # entry: urutan init, listener global, error boundary atas
│  │  ├─ config.js                 # base URL, TTL, KOTA_BESAR, PROXY_BASE, DEFAULTS
│  │  │
│  │  ├─ core/
│  │  │  ├─ store.js               # state + set() + subscribe() + select()
│  │  │  ├─ http.js                # fetchJson/fetchText: timeout 8s, retry 2x, dedupe, requestId
│  │  │  ├─ cache.js               # localStorage TTL (versioned key, quota guard)
│  │  │  ├─ dom.js                 # qs/qsa, createEl, setText (anti-XSS), toggleClass, on()
│  │  │  └─ router.js              # ScrollSpy (IntersectionObserver), hash nav, smooth scroll
│  │  │
│  │  ├─ services/
│  │  │  ├─ geocoding.service.js   # searchCity(), reverseGeocode()
│  │  │  ├─ forecast.service.js    # getCurrentWeather(), getDailyForecast(), getCitiesSummary()
│  │  │  ├─ bmkg.service.js        # getAlerts() via proxy, getLatestQuake() langsung
│  │  │  ├─ windy.service.js       # buildEmbedUrl(), setCoords(), setLayer()
│  │  │  └─ geo.service.js         # Geolocation API + error mapping
│  │  │
│  │  ├─ ui/
│  │  │  ├─ navbar.js              # mobile collapse, scrollspy active, locale switcher
│  │  │  ├─ search.js              # submit, validasi, autocomplete (debounce 300ms)
│  │  │  ├─ current-weather.js
│  │  │  ├─ forecast.js
│  │  │  ├─ cities.js              # 5 kartu kota (state per kartu)
│  │  │  ├─ alerts.js              # panel peringatan dini nasional (proxy + degraded)
│  │  │  ├─ quake.js               # panel gempa terkini nasional
│  │  │  ├─ map.js                 # iframe Windy, layer chips, legenda, lazy mount
│  │  │  ├─ faq.js                 # accordion Bootstrap + a11y
│  │  │  ├─ contact.js             # form kontak → mailto:
│  │  │  ├─ skeleton.js            # helper siklus skeleton/empty/error
│  │  │  └─ feedback.js            # toast, inline error, aria-live announcer
│  │  │
│  │  ├─ i18n/
│  │  │  ├─ id.js                  # dictionary ID (default)
│  │  │  ├─ en.js                  # dictionary EN
│  │  │  └─ i18n.js                # t(key), setLocale(), applyStaticTranslations()
│  │  │
│  │  └─ utils/
│  │     ├─ weather-code.js        # WMO code → {icon, labelId, labelEn, tone}
│  │     ├─ format.js              # Intl: suhu, %, km/j, tanggal/jam per timezone
│  │     ├─ text.js                # escapeHtml, stripTags, truncate, normalizeRegion
│  │     └─ validate.js            # nama kota (≥2 char), email
│  │
│  └─ img/
│     ├─ sprite-weather.svg        # ikon cuaca + varian malam (is_day)
│     ├─ logo-wjyava.svg
│     └─ favicon.svg
│
├─ server/                         # proxy CORS 1 endpoint (CAP aggregation di sisi server)
│  ├─ index.js                     # Express app, route /api/bmkg/alerts, /health
│  ├─ lib/
│  │  ├─ bmkg.js                   # fetch RSS + fetch & parse detail CAP (dengan pool & timeout)
│  │  ├─ parser.js                 # XML → objek (fast-xml-parser), normalisasi field
│  │  ├─ cache.js                  # Map + TTL + single-flight dedupe
│  │  └─ whitelist.js              # validasi URL upstream (host + path regex)
│  ├─ package.json                 # express, compression, fast-xml-parser
│  ├─ .env.example                 # PORT, ALLOWED_ORIGIN, CACHE_TTL_SECONDS, MAX_ALERTS
│  └─ README.md                    # cara run & uji manual (curl)
│
├─ docs/
│  ├─ api-contract.md              # kontrak endpoint + contoh respons
│  └─ test-checklist.md            # matriks uji manual (error, offline, a11y, browser)
│
└─ tests/                          # (opsional, Fase 3) uji parser Node tanpa framework
   └─ parser.test.js               # node --test, fixture XML BMKG
```

**Catatan struktur**
- Tidak ada folder `mock/` permanen. `assets/js/data/mock-data.js` hanya boleh ada di Fase 1 dan **dihapus** di Fase 2.
- Tidak ada aset build, tidak ada `dist/`, tidak ada `package.json` di root (root adalah static site murni). `package.json` hanya di `server/`.

---

## 3. Konvensi Modul & Import

### 3.1 Entry point di HTML

```html
<script type="module" src="assets/js/main.js"></script>
```

- Hanya **satu** script module di HTML. Semua modul lain diimpor dari `main.js` (transitive).
- Bootstrap JS **bukan** modul ES: dimuat via `<script defer src=".../bootstrap.bundle.min.js">` lalu diakses lewat global `window.bootstrap` (untuk `Collapse`, `Accordion`, `Toast`).
- Tidak menggunakan `<script type="importmap">` dan tidak ada bare specifier seperti `import bootstrap from 'bootstrap'`.

### 3.2 Aturan import (wajib, ditegakkan saat review)

```js
// assets/js/main.js
import { store } from './core/store.js';
import { initNavbar } from './ui/navbar.js';
import { initSearch } from './ui/search.js';
import { getAlerts } from './services/bmkg.service.js';
import { DEFAULT_CITY, CACHE_TTL } from './config.js';
```

| Aturan | Benar | Salah |
|---|---|---|
| Ekstensi eksplisit | `from './core/store.js'` | `from './core/store'` |
| Import direktori dilarang | `from './ui/alerts.js'` | `from './ui/alerts'` / `from './ui/'` |
| Path relatif dari file itu sendiri | `assets/js/ui/cities.js` → `from '../services/forecast.service.js'` | `from 'services/forecast.service.js'` |
| Library pihak ketiga | global `window.bootstrap` | `import ... from 'bootstrap'` |
| JSON | `fetch()` lalu `JSON.parse` | `import data from './x.json'` (butuh assert, tidak dipakai) |
| CSS | `<link rel="stylesheet">` | `import './style.css'` |

**Checklist review PR:** `grep -rn "from '\.\{1,2\}/[^']*'" assets/js` → setiap hasil harus diakhiri `.js`.

---

## 4. Hasil Verifikasi Endpoint (live, 16 Nov 2026)

Diuji dengan header `Origin: http://localhost:5500`:

| Endpoint | `Access-Control-Allow-Origin` | Kesimpulan |
|---|---|---|
| `geocoding-api.open-meteo.com/v1/search` | `*` | fetch langsung |
| `api.open-meteo.com/v1/forecast` (termasuk `current.uv_index`) | `*` | langsung |
| `data.bmkg.go.id/DataMKG/TEWS/autogempa.json` | `*` | langsung |
| `data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` | `*` | langsung |
| `api.bmkg.go.id/publik/prakiraan-cuaca` | `*` | langsung (tidak dipakai) |
| `www.bmkg.go.id/alerts/nowcast/id/rss.xml` | **tidak ada** | **wajib proxy** |
| `www.bmkg.go.id/alerts/nowcast/id/{ID}_alert.xml` | `*` | langsung (tetapi diambil proxy, §6.4) |
| `www.bmkg.go.id/alerts/nowcast/en` | **tidak ada** | via proxy |
| `embed.windy.com/embed2.html` | iframe | 200 OK |
| `api.bigdatacloud.net/.../reverse-geocode-client` | `*` | reverse geocode |

**Implikasi arsitektur:** proxy hanya menangani **feed + detail CAP**; seluruh cuaca, geocoding, dan gempa diambil langsung dari browser.

**Struktur data terverifikasi**
- `autogempa.json` → `Infogempa.gempa` = `{Tanggal, Jam, DateTime, Coordinates, Lintang, Bujur, Magnitude, Kedalaman, Wilayah, Potensi, Dirasakan?, Shakemap?}`.
- RSS peringatan → `<item>{title, link, description, pubDate, guid}`; **tidak ada** `severity`/`expires`.
- Detail CAP `*_alert.xml` → **ada** `severity`, `certainty`, `urgency`, `onset` (kadang kosong), `expires` (ISO 8601), `areaDesc`, `event`, `headline`, `description`, `senderName`, `status`, `msgType`.

---

## 5. Design System — "Dark Atmospheric Interface"

### 5.1 Token (`assets/css/tokens.css`)

| Token | Nilai | Pemakaian |
|---|---|---|
| `--bg-base` | `#0B1020` | body, latar utama |
| `--bg-surface` | `#151C2E` | card, panel, navbar, input |
| `--bg-surface-2` | `#1C2540` | hover, card bertumpuk, base skeleton |
| `--accent-primary` | `#6366F1` | tombol utama, border aktif |
| `--accent-primary-text` | `#818CF8` | aksen untuk **teks** di atas dark |
| `--slate` | `#64748B` | border, divider, label uppercase besar |
| `--text-secondary` | `#94A3B8` | body sekunder (bukan `#64748B`) |
| `--accent-mimosa` | `#F5D76E` | ikon cuaca, angka highlight, focus ring |
| `--text-primary` | `#E2E8F0` | teks utama |
| `--status-critical` | `#EF4444` | level **Merah** (CAP `Extreme`/`Severe`) |
| `--status-warning` | `#F59E0B` | level **Oranye** (CAP `Moderate`) |
| `--status-caution` | `#EAB308` | level **Kuning** (CAP `Minor`) |
| `--status-ok` | `#22C55E` | normal / tidak ada peringatan |
| `--status-neutral` | `#64748B` | severity tidak tersedia |

**Kontras (diukur terhadap `#151C2E`):** `#64748B` ≈ 3,4:1 → hanya untuk label uppercase ≥14px bold dan border. Body text memakai `#94A3B8` (≈6:1). `#6366F1` untuk teks diganti `#818CF8`.

### 5.2 Tipografi
- Headings: **Plus Jakarta Sans** 600/700. Body, UI, angka: **Inter** 400/500/600.
- `font-variant-numeric: tabular-nums` untuk suhu, magnitudo, metrik.
- Skala: display 56/64 · h2 32/40 · h3 20/28 · body 16/26 · caption 12/16 (uppercase, letter-spacing `.08em`).
- Load: `preconnect` ke `fonts.googleapis.com` + `fonts.gstatic.com`, `display=swap`.

### 5.3 Bootstrap 5 integration
- `<html lang="id" data-bs-theme="dark">`.
- `bootstrap-overrides.css` memetakan token ke variabel Bootstrap: `--bs-body-bg`, `--bs-body-color`, `--bs-border-color`, `--bs-primary`, `--bs-card-bg`, `--bs-accordion-*`, `--bs-form-control-*`.
- Dilarang memakai utilitas warna Bootstrap (`bg-primary`, `text-warning`) untuk konten data; gunakan class proyek (`.badge--critical`, `.metric__value`).
- Komponen Bootstrap yang dipakai: `container/row/col`, `navbar` + `collapse`, `accordion`, `form-control`/`form-select`, `toast`, `offcanvas` (menu mobile, opsional).

### 5.4 Spacing, radius, elevasi, motion
- Spacing scale: 4·8·12·16·24·32·48·64. Section padding 96px desktop / 64px mobile.
- Radius: 8 (input/chip) · 16 (card) · 24 (hero card) · 999 (pill).
- Elevasi: inset highlight `0 1px 0 rgba(255,255,255,.04)` + `0 24px 48px -24px rgba(0,0,0,.8)`.
- Motion: transisi 160ms/240ms `ease-out`; semua animasi (shimmer, smooth scroll) dimatikan saat `prefers-reduced-motion: reduce`.

---

## 6. Arsitektur Data & Kontrak API

### 6.1 Alur utama

```
[Boot]
  ├─ baca locale + lastLocation (localStorage, key "wjyava:v1:*")
  ├─ target = lastLocation || Jakarta (-6.2088, 106.8456)
  ├─ store.set('location', target)
  │
  ├─ forecast.service(target)                    → current + daily[5]
  ├─ cities.service() → Promise.allSettled       → 5 kartu kota
  ├─ bmkg.getAlerts(locale)  → {PROXY_BASE}/api/bmkg/alerts?lang=  (NASIONAL)
  ├─ bmkg.getLatestQuake()   → data.bmkg.go.id/autogempa.json      (NASIONAL)
  └─ map.mount() lazy saat section terlihat (IntersectionObserver)

[Aksi user]
  cari kota   → geocoding → pilih hasil → set location → forecast + map (BMKG TIDAK di-refetch)
  ganti layer → windy.setLayer() → rebuild src (debounce 250ms)
  ID/EN       → i18n.setLocale() → refetch alerts (lang=id|en) + re-render label
  Lokasi Saya → geolocation → reverseGeocode → pipeline sama dengan cari kota
```

### 6.2 Kontrak endpoint

| # | Fungsi | Endpoint | Cache | CORS |
|---|---|---|---|---|
| E1 | Geocoding | `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=10&language=id&format=json` | 24 jam/query | langsung |
| E2 | Reverse geocode | `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=id` | 24 jam | langsung |
| E3 | Cuaca + prakiraan | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=auto&forecast_days=5&wind_speed_unit=kmh` | 10 menit | langsung |
| E4 | Gempa terkini | `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` | 60 detik | langsung |
| E5 | Daftar gempa (fallback) | `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` | 5 menit | langsung |
| E6 | Peringatan dini (NASIONAL) | `http://localhost:8787/api/bmkg/alerts?lang=id` | 5 menit | proxy |
| E7 | Detail CAP (upstream, diakses **server**) | `https://www.bmkg.go.id/alerts/nowcast/{id\|en}/{ID}_alert.xml` | 5 menit | tidak dipakai browser |
| E8 | Windy embed | `https://embed.windy.com/embed2.html?lat={lat}&lon={lon}&detailLat={lat}&detailLon={lon}&zoom={z}&level=surface&overlay={wind\|rain\|temp\|clouds}&product=ecmwf&calendar=now&type=map&location=coordinates&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1` | — | iframe |

Kota besar (koordinat tetap, tanpa geocoding): Jakarta `-6.2088,106.8456` · Surabaya `-7.2575,112.7521` · Bandung `-6.9175,107.6191` · Medan `3.5952,98.6722` · Makassar `-5.1477,119.4327`.

**Open-Meteo free tier:** ±10.000 request/hari. Reload penuh = 1 + 5 request. Optimasi opsional Fase 4: satu panggilan multi-koordinat untuk 5 kota (`MULTI_LOCATION_MODE`), sementara `Promise.allSettled` tetap dipertahankan sesuai spesifikasi.

### 6.3 Mapping `weather_code` (WMO)

Modul `utils/weather-code.js` → `{ code: { icon, labelId, labelEn, tone } }`, `tone ∈ {clear, cloudy, rain, storm, fog, snow}`.

| Code | ID | EN | Ikon |
|---|---|---|---|
| 0 | Cerah | Clear sky | sun |
| 1 | Sebagian besar cerah | Mainly clear | sun-cloud |
| 2 | Berawan sebagian | Partly cloudy | sun-cloud |
| 3 | Mendung | Overcast | cloud |
| 45 | Kabut | Fog | fog |
| 48 | Kabut beku (rime) | Depositing rime fog | fog |
| 51 / 53 / 55 | Gerimis ringan / sedang / lebat | Light / Moderate / Dense drizzle | drizzle |
| 56 / 57 | Gerimis beku ringan / lebat | Freezing drizzle | drizzle |
| 61 | Hujan ringan | Slight rain | rain |
| 63 | Hujan sedang | Moderate rain | rain |
| 65 | Hujan lebat | Heavy rain | rain-heavy |
| 66 / 67 | Hujan beku ringan / lebat | Freezing rain | rain |
| 71 / 73 / 75 | Salju ringan / sedang / lebat | Snow fall | snow |
| 77 | Butir salju | Snow grains | snow |
| 80 / 81 / 82 | Hujan lokal ringan / sedang / lebat | Rain showers | rain / rain-heavy |
| 85 / 86 | Hujan salju ringan / lebat | Snow showers | snow |
| 95 | Badai petir | Thunderstorm | storm |
| 96 / 99 | Badai petir + hujan es ringan / lebat | Thunderstorm with hail | storm |

`is_day === 0` → varian malam untuk code 0–3. Kode tak dikenal → ikon `cloud` + label "Kondisi tidak dikenali (kode X)" (transparan, tidak menebak).

---

## 6.4 Proxy BMKG: Parsing Detail CAP di Sisi Server

**Alasan:** RSS BMKG tidak memiliki `severity`/`expires`, dan feed-nya tidak mengirim header CORS. Agar browser tidak perlu memanggil banyak URL XML, **agregasi + parsing CAP dilakukan di proxy**, dan browser hanya menerima satu JSON bersih.

### 6.4.1 Kontrak endpoint

```
GET /api/bmkg/alerts?lang=id|en        → 200 application/json
GET /health                            → 200 { ok, upstream, cacheAgeSeconds }
OPTIONS /api/bmkg/alerts               → 204 (CORS preflight)
```

Respons sukses (skema final — frontend hanya boleh bergantung pada field ini):

```json
{
  "source": "BMKG",
  "scope": "national",
  "language": "id",
  "sourceUrl": "https://www.bmkg.go.id/alerts/nowcast/id/rss.xml",
  "updatedAt": "2026-11-16T02:30:13.000Z",
  "fetchedAt": "2026-11-16T02:35:02.114Z",
  "stale": false,
  "items": [
    {
      "id": "2.49.0.1.360.0.2026.11.16.02.64.002",
      "headline": "Hujan Lebat disertai Petir di Kalimantan Timur",
      "event": "Hujan Lebat dan Petir",
      "severity": "Moderate",
      "level": "warning",
      "certainty": "Observed",
      "urgency": "Immediate",
      "area": "Kalimantan Timur",
      "onset": null,
      "expires": "2026-11-16T12:10:00+08:00",
      "publishedAt": "2026-11-16T02:25:00.000Z",
      "description": "Hujan lebat disertai petir akan terjadi pada 16 November 2026, 10:35 WITA ...",
      "senderName": "Badan Meteorologi Klimatologi dan Geofisika",
      "status": "Actual",
      "url": "https://www.bmkg.go.id/alerts/nowcast/id/CKT20261116002_alert.xml",
      "detailStatus": "ok"
    }
  ],
  "degraded": false
}
```

`level` adalah **turunan warna saja**, dipetakan 1:1 dari `severity` resmi:

| CAP `severity` | `level` | Warna token |
|---|---|---|
| `Extreme`, `Severe` | `critical` | `--status-critical` (Merah) |
| `Moderate` | `warning` | `--status-warning` (Oranye) |
| `Minor` | `caution` | `--status-caution` (Kuning) |
| lainnya / null | `unknown` | `--status-neutral` + label "Tingkat tidak disebutkan" |

> `severity` asli **selalu** disertakan dan ditampilkan sebagai teks. `level` tidak pernah menggantikan istilah resmi.

### 6.4.2 Algoritma di server (`server/lib/bmkg.js`)

1. **Validasi input:** `lang` hanya `id` atau `en` (default `id`); tolak selain itu dengan `400`.
2. **Cache lookup / single-flight:** key = `alerts:{lang}`. Jika ada hasil < `CACHE_TTL_SECONDS` (default 300) → kembalikan (`stale:false`). Jika ada request in-flight untuk key yang sama → ikut promise yang sama (mencegah thundering herd).
3. **Fetch RSS:** `https://www.bmkg.go.id/alerts/nowcast/{lang}/rss.xml`, timeout 8 s, `User-Agent: WJYAVA-Proxy/1.1`, `Accept: application/xml`, maks bodi 1 MB.
4. **Parse RSS** dengan `fast-xml-parser` (`ignoreAttributes: true`, `trimValues: true`) → ambil `channel.lastBuildDate` dan `channel.item[]`; normalisasi ke array (item tunggal tetap array).
5. **Batasi & urutkan:** ambil maksimum `MAX_ALERTS` (default 10), urutan **dipertahankan seperti BMKG** (jangan diacak).
6. **Ambil detail CAP** untuk setiap `item.link` — link **wajib** melewati whitelist `^https://www\.bmkg\.go\.id/alerts/nowcast/(id|en)/[A-Za-z0-9_.-]+\.xml$`. Fetch paralel dengan **pool maksimal 4** dan timeout 5 s per item; total anggaran 9 s.
7. **Parse CAP:** ekstrak `headline`, `event`, `severity`, `certainty`, `urgency`, `onset`, `expires`, `areaDesc`, `description`, `senderName`, `status`. Field hilang → `null` (jangan dikarang).
8. **Normalisasi:** `pubDate`/`lastBuildDate`/`expires` → ISO 8601 (`new Date(...).toISOString()`; `expires` disimpan juga dalam bentuk asli bila offset tidak valid). `description` di-trim dan spasi berlebih dirapikan, **tanpa mengubah kata**.
9. **Bangun `items`:** jika detail CAP gagal → tetap kirim item dengan `detailStatus: "unavailable"`, `severity: null`, `level: "unknown"`, dan `description` dari RSS (verbatim). **Item tidak pernah dibuang.**
10. **Respons:** header `Cache-Control: public, max-age=300`, `ETag` (hash isi), `Content-Type: application/json; charset=utf-8`.
11. **Gagal total (RSS unreachable / parse error):** `502` dengan `{ "error": "upstream_unavailable", "degraded": true, "sourceUrl": "...rss.xml" }` dan cache stale (jika ada) dikirim dengan `stale: true` + `Warning: 110 - "Response is Stale"`.

### 6.4.3 Keamanan proxy

- **Tidak ada URL dari klien.** Rute hanya menerima `lang`. Daftar upstream di-hardcode.
- Whitelist host + path regex (bukan `startsWith`) → mencegah SSRF dan redirect ke host lain (`redirect: 'manual'`, ikuti maks 1 redirect hanya ke host yang sama).
- Batas ukuran bodi (1 MB/item, total 5 MB), batas waktu, batas jumlah item.
- CORS: `Access-Control-Allow-Origin` dari env `ALLOWED_ORIGIN` (default `*` untuk dev), `Vary: Origin`; tanpa kredensial.
- Tanpa logging isi respons penuh (hanya status, durasi, jumlah item).
- Rate limit sederhana per IP (token bucket 30 req/menit) — opsional, diaktifkan bila proxy dipublikasikan.

### 6.4.4 Env (`server/.env.example`)

```
PORT=8787
ALLOWED_ORIGIN=http://localhost:5500
CACHE_TTL_SECONDS=300
MAX_ALERTS=10
```

### 6.4.5 Rantai fallback di frontend

```
PROXY_BASE kosong?           → degraded mode (tautan resmi) + label "Proxy belum dikonfigurasi"
fetch proxy gagal/timeout    → cache localStorage (≤5 menit) berlabel "data tersimpan · HH:mm"
cache kosong                 → degraded mode: pesan + tombol "Buka BMKG Alerts"
HTTP 502 dari proxy          → tampilkan pesan server + tautan resmi (bukan data rekaan)
```

Tidak ada pemanggilan RSS langsung dari browser (pasti gagal karena CORS). Fallback pihak ketiga (`allorigins.win`) hanya boleh di mode demo dengan badge eksplisit.

---

## 6.5 Konteks Nasional pada Panel BMKG

Aturan produk: **cuaca mengikuti lokasi pilihan pengguna, tetapi peringatan dini dan gempa selalu nasional Indonesia.**

| Kondisi | Panel Cuaca (Open-Meteo) | Panel Peringatan (BMKG) | Panel Gempa (BMKG) |
|---|---|---|---|
| Kota Indonesia (mis. Bandung) | Bandung | **Nasional** + badge `NASIONAL` | **Nasional** |
| Kota luar negeri (mis. Tokyo) | Tokyo | **Nasional** + catatan bahwa cuaca ≠ Indonesia | **Nasional** |
| Geolocation di luar Indonesia | Lokasi pengguna | **Nasional** + catatan | **Nasional** |
| Ganti bahasa EN | Label EN, data tetap dari Open-Meteo | Feed `nowcast/en` + badge "Sumber: BMKG (English)" | Teks asli BMKG ID + label sumber |

**Implementasi UI**
- Judul panel: `Peringatan Dini Cuaca — Indonesia` + badge `NASIONAL (BMKG)`; subjudul menampilkan cakupan: "Berlaku untuk wilayah Indonesia".
- Bila `state.location.country` ≠ `Indonesia`, tampilkan baris informasi (bukan error): *"Cuaca yang ditampilkan: {kota}, {negara}. Peringatan dini cuaca dan info gempa di bawah adalah data resmi BMKG untuk wilayah Indonesia."*
- **Highlight relevansi lokal:** bandingkan `item.area` dengan `state.location.admin1` (normalisasi huruf kecil, buang prefix "Provinsi"/"Kota"/"Kab."). Jika cocok → badge `Relevan dengan lokasi Anda`. Item lain tetap tampil (tidak difilter) dan urutan BMKG tidak diubah.
- **Gempa:** apakah gempa "relevan" tidak ditentukan oleh jarak yang kita hitung sendiri (itu bentuk prediksi). Yang ditampilkan hanya fakta: magnitudo, kedalaman, wilayah, waktu (string BMKG dipertahankan; versi waktu lokal disediakan sebagai teks sekunder), potensi tsunami **verbatim** dari field `Potensi`.
- **Atribusi wajib:** `senderName` / "BMKG", `updatedAt` dari `lastBuildDate`, dan tautan `url` ke CAP resmi (`rel="noopener noreferrer"`).
- **Empty state:** "Tidak ada peringatan dini cuaca aktif saat ini." + `updatedAt` (bukan menyembunyikan panel).
- **Degraded state:** pesan + tombol `Buka bmkg.go.id` (tautan resmi), tanpa item rekaan.

## 6.6 Windy Map

- State: `{ lat, lon, zoom, overlay, mounted, status }`. Perubahan koordinat/layer → rebuild `iframe.src` (debounce 250 ms).
- Overlay: `Angin → wind`, `Hujan → rain`, `Suhu → temp`, `Awan → clouds`. `zoom` default 5 (nasional), 8 setelah pilih kota.
- **Timeline:** embed2 punya player bawaan. Tombol `Sekarang / +6j / +12j / +24j` wajib di-**spike hari pertama Fase 2**. Jika parameter waktu tidak didukung → hapus tombol, tampilkan label "Gunakan timeline pada peta". Tidak boleh ada kontrol dekoratif.
- Performa: `loading="lazy"`, `title`, `referrerpolicy="strict-origin-when-cross-origin"`, mount via `IntersectionObserver`, skeleton gelap sampai `load`.
- Legenda: unit (km/j, °C, mm) + atribusi "Peta: Windy.com · Data: ECMWF". Legenda **tidak** mengklaim tingkat bahaya.

---

## 7. State Management

### 7.1 Bentuk state

```js
export const initialState = {
  meta:     { locale: 'id', unit: 'metric', online: true, hydratedFromCache: false },
  location: { name, country, admin1, lat, lon, timezone, source: 'search|geo|default' },
  search:   { query: '', status: 'idle', results: [], error: null }, // idle|loading|success|empty|error
  weather:  { status, data: { current, daily: [5] }, updatedAt, error },
  cities:   { status, data: [{ city, status, data, error }], updatedAt },
  alerts:   { status, data: { items: [], updatedAt, stale, degraded }, error, scope: 'national' },
  quake:    { status, data: { magnitude, depth, region, datetime, potential, url }, error },
  map:      { overlay: 'wind', zoom: 5, mounted: false, status: 'idle' },
  ui:       { menuOpen: false, activeSection: 'cuaca', toast: null }
};
```

Aturan:
- `store.set('weather', patch)` melakukan merge dangkal + notifikasi subscriber slice tersebut.
- `store.select('weather')` mengembalikan snapshot read-only.
- Modul UI **wajib** unsubscribe saat `component:hidden`/tidak terpakai (menghindari listener leak).
- Tidak ada state yang disimpan di DOM (`data-*` hanya untuk ID statis).
- Persist ke `localStorage`: `locale`, `location` terakhir, cache respons (TTL). Tidak menyimpan data pribadi.

### 7.2 HTTP layer (`core/http.js`)

- `AbortController` + timeout 8 s.
- Retry maksimal 2× untuk error jaringan/5xx (bukan 4xx) dengan backoff 500 ms, 1500 ms; **tidak** retry untuk 429 (langsung tampilkan banner).
- **Dedupe:** key = `url + params`; request identik yang in-flight dikembalikan sebagai promise yang sama.
- **`requestId` sequence:** setiap pencarian menaikkan counter; respons dengan `requestId` lebih lama **dibuang** (mencegah hasil kota lama menimpa kota baru).
- Semua respons JSON divalidasi bentuk minimalnya (`typeof data === 'object'`) sebelum masuk store.

---

## 8. Loading, Error & Empty States

### 8.1 Skeleton (zero CLS)
- Markup skeleton **statis di `index.html`**; `min-height` sama dengan state final; shimmer CSS; mati saat `prefers-reduced-motion`.
- `aria-busy="true"` per section; `aria-live="polite"` mengumumkan "Data diperbarui".

### 8.2 Matriks error

| Skenario | Deteksi | UI | Perilaku data |
|---|---|---|---|
| Loading awal | `status=loading` | Skeleton per card | — |
| Kota tidak ditemukan | `results.length === 0` | Inline error: "Kota 'x' tidak ditemukan" + 3 saran (query lebih pendek) | Data lama tetap tampil |
| Input < 2 karakter | validasi | Pesan aria-live, tombol disabled | Tanpa request |
| Geocoding 5xx/jaringan | `!res.ok`/TypeError | Hero error + "Coba lagi" | Cache lokasi terakhir |
| Forecast gagal | `status=error` | Card cuaca: pesan + retry; forecast 5 hari tetap tampil bila sukses | Cache + badge "tersimpan · HH:mm" |
| 1 dari 5 kota gagal | `Promise.allSettled` | Hanya kartu itu: "Gagal memuat · Coba lagi" | 4 kartu lain normal |
| Peringatan: proxy 502 | HTTP 502 | Pesan + tautan resmi BMKG | Cache stale (≤5 menit) berlabel |
| Peringatan: proxy offline | `ERR_CONNECTION_REFUSED`/timeout | Degraded mode + instruksi `node server/index.js` (dev) | Cache stale |
| Peringatan kosong | `items.length === 0` | Empty state positif + `updatedAt` | — |
| Gempa gagal | error | Pesan + retry | Fallback E5 → cache |
| Offline | `navigator.onLine` / event | Banner tipis "Anda offline — data terakhir" | Semua dari cache |
| Geolocation ditolak/timeout | `GeolocationPositionError` 1/2/3 | Toast sesuai kode + fokus ke input | Lokasi aktif tidak berubah |
| Windy gagal | `iframe.onerror`/timeout 10 s | Placeholder + "Buka Windy di tab baru" | Layer tersimpan |
| 429 | HTTP 429 | Banner "Batas permintaan tercapai…" | Cache |

**Prinsip:** setiap kegagalan = pesan jelas + aksi (retry / buka sumber resmi) + penanda kesegaran data. Tidak ada angka fiktif, tidak ada "0 km/j" akibat gagal parse.

### 8.3 Keamanan & aksesibilitas
- Semua teks eksternal → `textContent`; helper `dom.setText(el, value)`.
- Tautan eksternal: `target="_blank" rel="noopener noreferrer"`.
- `:focus-visible` 2 px mimosa; skip-link ke `#main`; toggle (bahasa/layer/accordion) dapat dioperasikan keyboard.
- Kontras minimum 4.5:1 untuk teks normal, 3:1 untuk teks besar.

---

## 9. Peta Section → Komponen → Atribusi

| # | Section | Elemen kunci | Atribusi wajib |
|---|---|---|---|
| 1 | Navbar | logo `WJYAVA / WEATHER INTELLIGENCE`, 4 link + ScrollSpy (`Cuaca`, `Peta Interaktif`, `Peringatan`, `Tentang`), toggle `ID/EN`, `Lokasi Saya`, hamburger | — |
| 2 | Hero + Current Weather | tag `LIVE CONDITIONS / INDONESIA`, headline *"Know the sky. Plan with confidence."*, deskripsi, form cari; card: kota+negara, waktu update, suhu besar, ikon+status, "Terasa seperti", metrik `KELEMBABAN`/`ANGIN`/`UV` | Open-Meteo · diperbarui HH:mm |
| 3 | 5-Day Forecast | 5 card: hari (`Intl`), ikon, max/min, deskripsi | Open-Meteo |
| 4 | Peta Atmosfer | iframe Windy, chip layer (`Angin`/`Hujan`/`Suhu`/`Awan`), kontrol timeline, legenda | Windy.com · ECMWF |
| 5 | 5 Kota Besar | Jakarta, Surabaya, Bandung, Medan, Makassar | Open-Meteo |
| 6 | Peringatan & Gempa (7/5) | Peringatan: badge `NASIONAL`, `border-left` sesuai level, headline verbatim, `event`, wilayah, masa berlaku, sumber BMKG, waktu update, tautan resmi · Gempa: magnitudo, kedalaman, wilayah, waktu, potensi tsunami, tautan | BMKG + tautan resmi |
| 7 | Tentang / FAQ / Kontak (3 col) | narasi WJYAVA, accordion FAQ, form email+pesan → `mailto:` | — |
| 8 | Footer | brand+tagline, nav, atribusi `BMKG` & `Open-Meteo`, disclaimer prakiraan, copyright | wajib |

**Form kontak (keputusan disepakati):** validasi klien (email regex sederhana, pesan ≥ 10 karakter) → buka `mailto:` dengan subjek & body ter-encode; tampilkan status "Membuka klien email…" dan tautan cadangan alamat email. Tidak ada data terkirim ke server.

---

## 10. Roadmap Bertahap

### Fase 0 — Fondasi (0,5 hari)
- Struktur folder, `index.html` kerangka 8 section semantik, Bootstrap 5 + fonts via CDN (`data-bs-theme="dark"`).
- `tokens.css` lengkap, `server/.env.example`, `.gitignore`, `README.md` kerangka.
- Static server lokal (`npx serve`) → pastikan `type="module"` dan import `.js` bekerja.
- **DoD:** halaman berjalan tanpa error konsol; kerangka section terlihat; tidak ada file JS implementasi fitur.

### Fase 1 — Slicing UI & Design System (2–3 hari)
1. Navbar (desktop + collapse mobile + toggle bahasa visual).
2. Hero 2-col + form pencarian (default/hover/focus/error).
3. Card cuaca terkini (hierarki suhu, grid metrik, timestamp).
4. 5 card forecast → scroll-snap horizontal pada mobile.
5. Container peta (aspect-ratio, chip layer, legenda, placeholder iframe).
6. 5 kartu kota besar.
7. Panel peringatan (asymmetric 7/5, badge `NASIONAL`) + panel gempa.
8. About / FAQ / Kontak + footer.
9. Skeleton, empty, error state dengan `mock-data.js` (sementara).
- **DoD:** responsif 360/768/1024/1440; kontras lolos; CLS ≈ 0; Lighthouse A11y ≥ 95; semua import berekstensi `.js`.

### Fase 2 — Integrasi Open-Meteo & Windy (2 hari)
1. `config.js`, `http.js`, `store.js`, `cache.js`, `dom.js`.
2. Geocoding + autocomplete (debounce 300 ms, prioritaskan `country_code === 'ID'`, tampilkan `admin1`).
3. Forecast + renderer current/daily (`Intl` mengikuti `timezone` respons).
4. `weather-code.js` + sprite ikon (varian malam).
5. Windy: sinkron koordinat, layer, lazy mount, **spike kontrol timeline**.
6. `cities.js` dengan `Promise.allSettled`.
7. Hapus `mock-data.js`.
- **DoD:** cari "Bandung" → card + 5 hari + peta berubah; ganti layer bekerja; "kota tidak ditemukan" bekerja; tidak ada mock tersisa.

### Fase 3 — BMKG (Proxy + CAP), Interaksi Lanjutan & Pengujian (3 hari)
1. **Proxy:** `server/index.js` + `lib/whitelist.js`, `lib/parser.js`, `lib/bmkg.js`, `lib/cache.js`; endpoint `/api/bmkg/alerts` + `/health`; parsing detail CAP di server (§6.4).
2. **Uji proxy manual:** `curl "http://localhost:8787/api/bmkg/alerts?lang=id"` → validasi jumlah item, `severity`, `expires`, `detailStatus`; uji `lang=en`; uji `lang=xx` → 400; uji cache (panggilan kedua < 50 ms); uji RSS mati (mock) → 502 + `degraded`.
3. `bmkg.service.js` + `alerts.js`: render nasional (§6.5), badge level dari `severity`, highlight provinsi cocok, tautan CAP, degraded mode, cache stale.
4. `quake.js`: gempa terkini langsung dari `data.bmkg.go.id`, fallback `gempaterkini.json`, atribusi BMKG.
5. i18n penuh (ID/EN): label UI, `Intl` nama hari, refetch alert `lang=en`, persist locale.
6. Geolocation + reverse geocode + penanganan izin & luar Indonesia (catatan nasional muncul).
7. FAQ a11y, form kontak `mailto:`.
8. ScrollSpy `IntersectionObserver`, mobile menu close-on-click, smooth scroll.
9. Pengujian: matriks error (offline, blokir domain via DevTools, koordinat invalid, proxy dimatikan), cross-browser (Chrome/Edge/Firefox/Safari), Lighthouse Performance ≥ 90 & A11y ≥ 95, keyboard-only, kontras.
- **DoD:** setiap panel menampilkan sumber + waktu update; teks BMKG verbatim; proxy mati → degraded mode terbukti; tidak ada `innerHTML` untuk data eksternal; `docs/test-checklist.md` terisi.

### Fase 4 — Polish, Performa & Dokumentasi (1 hari)
- `preconnect` (api.open-meteo.com, geocoding-api, embed.windy.com); target JS kustom < 60 KB.
- Sinkron hash URL (`?city=bandung`) untuk tautan yang dapat dibagikan.
- `README.md` lengkap (static + proxy + troubleshooting CORS), `docs/api-contract.md`.
- Disclaimer footer; opsional: `MULTI_LOCATION_MODE`, unit °C/°F, PWA manifest.

**Total estimasi:** 9–11 hari kerja.

---

## 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| RSS BMKG tanpa CORS | Panel peringatan kosong | Proxy 1 endpoint + degraded mode (§6.4.5) |
| Detail CAP berubah struktur / item hilang | Field kosong | Parser defensif; item tetap dikirim dengan `detailStatus: "unavailable"`; tidak membuang item |
| RSS berisi 30+ item → proxy lambat | Latensi | `MAX_ALERTS=10`, pool 4, timeout 5 s/item, cache 5 menit, single-flight |
| Proxy terbuka ke publik | Penyalahgunaan / SSRF | Whitelist regex, tanpa URL dari klien, rate limit, `ALLOWED_ORIGIN` eksplisit |
| Timeline Windy tidak dapat dikontrol | Kontrol mati | Spike hari pertama Fase 2; hapus kontrol bila tidak valid |
| Rate limit / API down | Data tidak tampil | Cache TTL berlapis + stale-while-revalidate + badge kesegaran |
| Kontras slate gagal WCAG | A11y turun | Body memakai `#94A3B8`; audit Fase 1 |
| Interpretasi berlebihan atas peringatan | Pelanggaran integritas data | Teks verbatim; hanya `severity`/`expires`/`areaDesc` resmi yang dipetakan; tanpa jarak/episentrum hitungan sendiri |
| Pengguna mengira peringatan mengikuti kota asing | Kebingungan | §6.5: badge `NASIONAL` + catatan eksplisit + highlight provinsi |

---

## 12. Definisi Selesai Proyek
1. 8 section berfungsi dengan data live; tidak ada data dummy.
2. Setiap blok data menampilkan **sumber** + **waktu pembaruan**.
3. Tiga jalur lokasi bekerja: pencarian, geolocation, default.
4. Panel BMKG selalu menampilkan konteks **nasional Indonesia** dengan badge dan catatan yang jelas.
5. Proxy mengembalikan JSON CAP yang sudah dinormalisasi; degraded mode terbukti saat proxy dimatikan.
6. Semua state gagal punya pesan + aksi; konsol bersih dari error.
7. Responsif 360–1440 px, keyboard-navigable, Lighthouse A11y ≥ 95, Performance ≥ 90.
8. Setiap import relatif berekstensi `.js`; tidak ada bare specifier.
9. `README.md` + `docs/api-contract.md` + `docs/test-checklist.md` lengkap.

---

## 13. Urutan Eksekusi Berikutnya
1. Setujui PLAN.md ini (dokumen = kontrak kerja).
2. Fase 0 → Fase 1 (slicing UI, mock data sementara).
3. Fase 2 (Open-Meteo + Windy), hapus mock.
4. Fase 3 (proxy BMKG + CAP aggregation + panel nasional + pengujian).
5. Fase 4 (performa, dokumentasi, polish).
