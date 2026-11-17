# Kontrak API

> **Status: Fase 4 selesai.** Geocoding, forecast Open-Meteo, gempa BMKG, proxy
> peringatan dini (RSS + CAP), reverse geocode, embed Windy, dan tautan lokasi
> `?city=…` sudah aktif. Sumber kebenaran tetap [PLAN.md](../PLAN.md) §6.

## Ringkasan endpoint

| # | Fungsi | Endpoint | Cache | CORS | Status |
|---|---|---|---|---|---|
| E1 | Geocoding | `https://geocoding-api.open-meteo.com/v1/search?name={q}&count=10&language=id&format=json` | 24 jam/query | langsung | **aktif** |
| E2 | Reverse geocode | `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude={lat}&longitude={lon}&localityLanguage=id\|en` | 24 jam | langsung | **aktif** |
| E3 | Cuaca + prakiraan | `https://api.open-meteo.com/v1/forecast?...` | 10 menit | langsung | **aktif** |
| E4 | Gempa terkini | `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` | 60 detik | langsung | **aktif** |
| E5 | Daftar gempa (fallback) | `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` | 5 menit | langsung | **aktif** |
| E6 | Peringatan dini (nasional) | `http://localhost:8787/api/bmkg/alerts?lang=id\|en` | 5 menit | proxy | **aktif** |
| E7 | Detail CAP (upstream, server saja) | `https://www.bmkg.go.id/alerts/nowcast/{id\|en}/{ID}_alert.xml` | mengikuti E6 | tidak dipakai browser | **aktif** |
| E8 | Windy embed | `https://embed.windy.com/embed2.html?...` | — | iframe | **aktif** |
| E9 | Health proxy | `http://localhost:8787/health` | — | proxy | **aktif** |

## E1 — Geocoding (aktif)

Modul: `assets/js/services/geocoding.service.js`.

- Query dinormalisasi (trim, lowercase, spasi dirapatkan) sebagai key cache.
- Hasil duplikat (nama + koordinat dibulatkan 3 desimal) dibuang.
- Urutan: `country_code === "ID"` lebih dulu, lalu populasi menurun.
- Field hasil yang dipakai UI: `id`, `name`, `admin1`, `country`,
  `countryCode`, `lat`, `lon`, `timezone`, `population`, `source`.
- `suggestCities()` memakai `KOTA_BESAR` sebagai saran statis saat hasil kosong.
- Cache key: `wjyava:v2:geo:{query}:10`, TTL 24 jam.

## E2 — Reverse geocode (aktif)

Modul: `assets/js/services/geo.service.js`.

```
GET https://api.bigdatacloud.net/data/reverse-geocode-client
    ?latitude={lat}&longitude={lon}&localityLanguage={id|en}
```

- Dipanggil setelah Position API memberi koordinat; `localityLanguage`
  mengikuti locale aktif.
- Cache key: `wjyava:v2:geo:{lat.toFixed(3)},{lon.toFixed(3)}:{lang}`,
  TTL 24 jam.
- Kegagalan reverse geocode tidak membatalkan pemilihan lokasi: UI memakai
  `coordinateLocation()` tanpa nama tempat dan menampilkan toast yang sesuai.
- Error Position API dipetakan ke kode stabil: `denied`, `unavailable`,
  `timeout`, `failed`, dan `unsupported` (API tidak tersedia).
- Penolakan/timeout **tidak** mengubah kota aktif; fokus kembali ke input
  pencarian.

## E3 — Cuaca + prakiraan (aktif)

Modul: `assets/js/services/forecast.service.js`.

Parameter yang dikirim:

```
current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,
        precipitation,weather_code,cloud_cover,wind_speed_10m,
        wind_direction_10m,uv_index
daily=weather_code,temperature_2m_max,temperature_2m_min,
      precipitation_probability_max,uv_index_max,sunrise,sunset
timezone=auto
forecast_days=5
wind_speed_unit=kmh
```

Bentuk normalisasi yang menjadi kontrak UI:

```js
{
  location: { id, name, admin1, country, countryCode, lat, lon, timezone, source },
  timezone: 'Asia/Jakarta',
  utcOffsetSeconds: 25200,
  elevation: 8,
  current: {
    time: '2026-11-16T14:00',       // waktu lokal Open-Meteo
    instant: '2026-11-16T07:00:00.000Z',
    temperature: 33,
    apparentTemperature: 38,
    humidity: 56,
    isDay: 1,
    precipitation: 0,
    weatherCode: 3,
    cloudCover: 88,
    windSpeed: 9,
    windDirection: 240,
    uvIndex: 3.2
  },
  daily: [
    { date: '2026-11-16', weatherCode: 3, tempMax: 33, tempMin: 25,
      rainProbability: 99, uvIndexMax: 4, sunrise, sunset }
  ],
  source: 'Open-Meteo',
  updatedAt: '2026-11-16T07:00:00.000Z',
  fetchedAt: '2026-11-16T07:04:12.000Z',
  stale: false
}
```

- `current.time` tidak ber-offset, sehingga dikonversi dengan
  `parseLocalIso(time, utc_offset_seconds)` sebelum diformat `Intl`.
- Tanggal `daily.time` adalah tanggal kalender; diformat dalam UTC agar tidak
  bergeser hari.
- Cache key: `wjyava:v2:forecast:{lat.toFixed(4)},{lon.toFixed(4)}`, TTL 10 menit.
- Cache masih segar → dipakai tanpa request. Request gagal → cache kedaluwarsa
  dipakai dengan `stale: true`; UI menampilkan **Data tersimpan**.
- `getCitiesSummary()` memakai `Promise.allSettled` untuk lima kota tetap.
  Setiap item berbentuk `{ city, status: 'ok'|'error', data, error }`.

## E4/E5 — Gempa BMKG (aktif)

Modul: `assets/js/services/bmkg.service.js`.

```
E4 GET https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json        (60 detik)
E5 GET https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json     (5 menit, fallback)
```

Normalisasi field `Infogempa.gempa`:

```js
{
  source: 'BMKG', scope: 'national', via: 'autogempa' | 'gempaterkini',
  magnitude: 4.8, magnitudeText: '4.8',
  depth: '10 km', region: 'Pusat gempa berada di ...',
  dateText: '17 Nov 2026', timeText: '07:49:00 WIB',
  dateTime: '2026-11-17T00:49:00.000Z',
  coordinates, latitude, longitude,
  potential: 'Tidak berpotensi tsunami',
  felt: '-',
  shakemapUrl: 'https://data.bmkg.go.id/DataMKG/TEWS/{Shakemap}',
  url: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg',
  updatedAt, stale: false, fallback?: true
}
```

- `Magnitude` diubah ke angka untuk tampilan; `magnitudeText` disimpan sebagai
  fallback bila BMKG mengirim format tak terduga.
- `region`, `potential`, `felt`, `dateText`, dan `timeText` adalah teks BMKG
  **verbatim** — tidak diterjemahkan dan tidak dihitung ulang.
- Waktu lokal dihitung dari `DateTime` dan ditampilkan sebagai teks sekunder
  (`Waktu lokal: ...`).
- Jika `autogempa.json` gagal, `gempaterkini.json` dipakai dan UI menampilkan
  catatan fallback. Jika keduanya gagal, cache stale terakhir dipakai; jika
  tidak ada cache, panel error tanpa magnitudo rekaan.

## E6 — Proxy peringatan dini (aktif)

Server: `server/index.js` (ESM, Express). Hanya satu rute data:

```
GET /api/bmkg/alerts?lang=id|en
GET /health
```

- `lang` hilang → default `id`. Nilai selain `id`/`en` → **400**
  `{ error: "invalid_language", degraded: true }`.
- Klien tidak pernah mengirim URL upstream; server memilih feed resmi:
  `https://www.bmkg.go.id/alerts/nowcast/{id|en}/rss.xml`.
- Respons 200 memiliki `ETag`, `Cache-Control: public, max-age=300`
  (60 detik saat stale), `Vary: Origin`, dan CORS sesuai `ALLOWED_ORIGIN`.
- `If-None-Match` yang cocok → **304**.
- Upstream gagal dan tidak ada cache → **502**
  `{ error: "upstream_unavailable", message, degraded: true, sourceUrl }`.
- Stale cache tersedia → 200 dengan `stale: true` + header
  `Warning: 110 - "Response is Stale"`.

Bentuk respons:

```json
{
  "source": "BMKG",
  "scope": "national",
  "language": "id",
  "sourceUrl": "https://www.bmkg.go.id/alerts/nowcast/id/rss.xml",
  "updatedAt": "2026-11-17T04:01:00.000Z",
  "fetchedAt": "2026-11-17T04:05:02.114Z",
  "stale": false,
  "degraded": false,
  "items": [
    {
      "id": "https://www.bmkg.go.id/alerts/nowcast/id/CKS20261117001_alert.xml",
      "headline": "Hujan Lebat ...",
      "event": "Hujan Lebat",
      "severity": "Moderate",
      "level": "warning",
      "certainty": "Likely",
      "urgency": "Expected",
      "area": "Kalimantan Selatan",
      "onset": "2026-11-17T06:00:00+08:00",
      "expires": "2026-11-17T14:00:00+08:00",
      "publishedAt": "2026-11-17T04:01:00.000Z",
      "description": "...",
      "senderName": "BMKG",
      "status": "Actual",
      "url": "https://www.bmkg.go.id/alerts/nowcast/id/CKS20261117001_alert.xml",
      "detailStatus": "ok",
      "detailError": null
    }
  ]
}
```

Aturan agregasi (PLAN §6.4):

- RSS timeout 8 detik, maksimum 1 MB.
- Detail CAP: pool maksimum 4, timeout 5 detik/item, total anggaran 9 detik.
- Maksimum 8 item (`MAX_ALERTS`, dibatasi 5–8) — urutan RSS dipertahankan.
- `detailStatus: "unavailable"` bila detail CAP gagal; item tetap tampil dengan
  teks RSS dan `detailError`, bukan dibuang.
- `level` hanya turunan warna dari `severity` resmi:
  Extreme/Severe → `critical`, Moderate → `warning`, Minor → `caution`,
  lainnya → `unknown`. Istilah resmi selalu ditampilkan sebagai teks.
- Cache 5 menit (`CACHE_TTL_SECONDS`) + single-flight per bahasa.
- Whitelist host dan path regex; redirect manual maksimal 1× hanya ke host BMKG
  yang sama.

Contoh verifikasi:

```bash
curl -i "http://localhost:8787/api/bmkg/alerts?lang=id"
curl -i "http://localhost:8787/api/bmkg/alerts?lang=en"
curl -i "http://localhost:8787/api/bmkg/alerts?lang=xx"   # 400
curl -i "http://localhost:8787/health"
```

## E7 — Detail CAP (aktif, server saja)

Whitelist:

```text
^https://www\.bmkg\.go\.id/alerts/nowcast/(id|en)/[A-Za-z0-9_.-]+\.xml$
```

- URL wajib berasal dari item RSS resmi dan lolos whitelist sebelum di-fetch.
- Browser tidak pernah menerima atau memanggil URL detail CAP secara langsung;
  tautan CAP hanya dipakai sebagai `href` atribusi untuk pengguna.
- Field yang dinormalisasi: `headline`, `event`, `severity`, `certainty`,
  `urgency`, `onset`, `expires`, `area`, `description`, `senderName`,
  `status`, `identifier`.

## E8 — Windy embed (aktif)

Modul: `assets/js/services/windy.service.js`.

```
https://embed.windy.com/embed2.html
  ?lat={lat}&lon={lon}&detailLat={lat}&detailLon={lon}
  &zoom={5|8}&level=surface&overlay={wind|rain|temp|clouds}
  &product=ecmwf&calendar=now&type=map&location=coordinates
  &metricWind=km/h&metricTemp=°C&radarRange=-1
```

- Zoom `5` = domain Indonesia; zoom `8` setelah pengguna memilih kota.
- Pemetaan chip: Angin→`wind`, Hujan→`rain`, Suhu→`temp`, Awan→`clouds`.
- Iframe dibuat lazy via `IntersectionObserver`, rebuild layer di-debounce
  250 ms, dan fallback tampil jika `load` tidak terjadi dalam 10 detik.
- `embed2.html` sudah memiliki timeline bawaan; tidak ada tombol timeline
  eksternal yang dikarang.

## E9 — Health proxy (aktif)

```json
{
  "ok": true,
  "upstream": "BMKG",
  "cacheEntries": 2,
  "cacheAgeSeconds": 12,
  "cacheTtlSeconds": 300,
  "maxAlerts": 8
}
```

## U — URL lokasi klien (Fase 4)

Modul: `assets/js/core/url.js`. Ini bukan endpoint API; URL hanya menyimpan
kota aktif di address bar agar tautan bisa dibagikan.

```
https://host/index.html?city=Bandung&lat=-6.9175&lon=107.6191
  &admin1=Jawa+Barat&country=Indonesia&cc=ID&tz=Asia%2FJakarta
```

| Parameter | Wajib | Aturan |
|---|---|---|
| `city` | ya | Nama tampilan, di-trim, maks. 120 karakter |
| `lat` | bersama `lon` | Angka finite, −90…90 |
| `lon` | bersama `lat` | Angka finite, −180…180 |
| `admin1` | tidak | Teks maks. 120 karakter |
| `country` | tidak | Teks maks. 120 karakter |
| `cc` | tidak | Dua huruf, di-uppercase; format lain diabaikan |
| `tz` | tidak | IANA timezone, maks. 64 karakter |

- **Prioritas boot:** `?city` + koordinat valid → `?city` slug kota besar →
  `localStorage` `last-location` → Jakarta.
- **Penulisan:** hanya `history.replaceState`, dipanggil saat pengguna memilih
  kota (pencarian, geolocation, chip, kartu kota). Tidak menambah entri riwayat.
- **Parameter lain** (mis. `utm_*`) dipertahankan saat URL ditulis ulang.
- **Validasi:** koordinat di luar rentang diabaikan. Bila `city` cocok dengan
  kota besar, data seed dipakai; bila tidak, seluruh parameter lokasi diabaikan
  dan aplikasi jatuh ke lokasi tersimpan.
- **Keamanan:** parameter URL tidak pernah dikirim ke API mana pun; hanya
  `lang` yang dikirim ke proxy BMKG.

## Aturan wajib

- **Data BMKG selalu nasional.** Peringatan dini dan gempa tidak pernah
  difilter mengikuti kota pilihan pengguna.
- **Tidak ada URL dari klien ke proxy.** Rute proxy hanya menerima `lang`;
  daftar upstream di-hardcode dan divalidasi dengan whitelist regex.
- **Anti-XSS.** Semua teks eksternal masuk lewat `textContent` / helper
  `core/dom.js`. Tidak ada `innerHTML` untuk data.
- **Integritas data.** Setiap panel menampilkan sumber + waktu pembaruan;
  kegagalan menampilkan pesan + aksi, bukan angka rekaan.
- **Import relatif berekstensi `.js`.** Tidak ada bundler.

## Penanganan error Fase 3

| Kondisi | Perilaku |
|---|---|
| Timeout HTTP umum | `HttpError.code = 'timeout'`, retry 2× (500 ms, 1500 ms) |
| Proxy alert timeout/gagal | Cache klien ≤5 menit dipakai sebagai stale berlabel; jika tidak ada, degraded + tautan resmi |
| Proxy 400/502 | Tidak di-retry sebagai 5xx; pesan server + tautan resmi |
| Cache alert >5 menit | Tidak dipakai; degraded state (tidak ada data setengah basi) |
| Detail CAP gagal | Item RSS tetap tampil, badge `Detail CAP tidak tersedia` |
| Gempa `autogempa` gagal | Fallback `gempaterkini` + catatan; lalu cache stale |
| Reverse geocode gagal | Lokasi koordinat tanpa nama + toast; kota aktif tetap berubah hanya jika koordinat valid |
| Geolocation ditolak/timeout | Toast sesuai kode, fokus ke input, kota aktif tidak berubah |
| Peta Windy timeout | Fallback + tombol muat ulang + tautan tab baru |
| Satu kota gagal | Hanya kartu itu error; empat kartu lain tetap tampil |
| Pencarian cepat berganti | `requestId` memastikan hanya hasil terbaru dipakai |
| Request yang di-abort | Tidak di-dedupe dengan request baru |

## Rantai fallback panel BMKG (klien)

```
proxy belum dikonfigurasi → degraded + label "Proxy belum dikonfigurasi"
proxy gagal/timeout       → cache localStorage ≤5 menit ("data tersimpan · HH:mm")
cache kosong/>5 menit     → degraded: pesan + tombol "Buka BMKG Alerts"
HTTP 502 dari proxy       → pesan server + tautan resmi
```

RSS BMKG **tidak pernah** dipanggil langsung dari browser (CORS).
