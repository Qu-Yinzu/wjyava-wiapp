# WJYAVA — Weather Intelligence Interface

Antarmuka cuaca untuk Indonesia: cuaca terkini, prakiraan 5 hari, peta atmosfer,
serta peringatan dini dan info gempa resmi BMKG.

> **Status saat ini:** Fase 4 selesai — seluruh fitur Fase 0–3 berjalan dengan
> data **live**, ditambah tautan kota yang dapat dibagikan (`?city=…`), audit
> performa/aset, disclaimer footer, dokumentasi akhir, serta tema **gelap
> (default) / terang** yang tersimpan di browser. Peringatan dan gempa selalu
> berskala **nasional Indonesia**, apa pun kota yang dipilih.

## Menjalankan secara lokal

Halaman adalah static site murni (tanpa bundler). Karena memakai ES Modules,
buka melalui server lokal — bukan `file://`. Peringatan BMKG memerlukan proxy
lokal karena feed RSS/CAP BMKG tidak mengizinkan CORS dari browser.

```bash
# Terminal 1 — proxy BMKG (butuh Node 18.17+)
cd server
npm install
node index.js
# → http://localhost:8787

# Terminal 2 — static site
python -m http.server 5500
# → http://localhost:5500
```

Buka `http://localhost:5500`. Proxy memakai `ALLOWED_ORIGIN=*` untuk dev; lihat
`server/README.md` dan `server/.env.example` untuk konfigurasi lain. Rute yang
tersedia hanya `GET /api/bmkg/alerts?lang=id|en` dan `GET /health`.

Jika proxy belum dijalankan, panel peringatan menampilkan **degraded mode** yang
jujur: pesan, instruksi menjalankan proxy, dan tautan resmi BMKG — tanpa alert
rekaan. Panel gempa tetap memuat langsung dari `data.bmkg.go.id`.

### Troubleshooting CORS

- **`Access-Control-Allow-Origin` muncul di console.** Pastikan proxy benar-benar
  hidup (`curl http://localhost:8787/health`) dan origin halaman diizinkan.
  Default dev memakai `*`; bila `ALLOWED_ORIGIN` diisi, nilainya harus sama
  persis dengan origin browser (mis. `http://127.0.0.1:5500`, bukan
  `http://localhost:5500`).
- **Halaman HTTPS memanggil proxy HTTP.** Browser memblokir mixed content.
  Jalankan halaman dan proxy pada HTTP lokal, atau letakkan keduanya di balik
  HTTPS yang sama.
- **Proxy hidup tetapi panel degraded.** Kemungkinan upstream BMKG sedang lambat
  atau format CAP berubah. Proxy tetap mengirim item RSS dengan
  `detailStatus: "unavailable"`; cek `/health` dan log proxy.
- **`file://` tidak bekerja.** ES Modules dan `replaceState` memerlukan origin
  HTTP. Selalu buka lewat server lokal.

## Struktur

```
index.html                # 8 section semantik, hook data-i18n
assets/css/               # tokens, base, layout, components, bootstrap-overrides, responsive
assets/js/main.js         # boot, loader cuaca/kota/BMKG, retry, persistensi lokasi
assets/js/config.js       # base URL, TTL cache, KOTA_BESAR, lokasi default
assets/js/core/           # dom, store (pub/sub per-slice), http (retry/dedupe), cache, router, url
assets/js/i18n/           # id.js, en.js, i18n.js (t(), applyStaticTranslations, persistensi)
assets/js/services/       # geocoding, forecast, bmkg (alert/quake), geo, windy
assets/js/ui/             # search, current-weather, forecast, cities, map, alerts, quake,
                          # navbar, faq, contact, blocks, feedback, skeleton
assets/js/utils/          # weather-code (WMO), format (Intl + CAP timezone), text (normalisasi wilayah)
assets/img/               # logo, favicon, sprite ikon cuaca siang/malam
server/                   # Express ESM: whitelist, RSS+CAP parser, cache/single-flight
docs/                     # kontrak API & checklist uji
PLAN.md                   # dokumen kontrak kerja
```

## Fitur & perilaku

- **Lokasi awal:** tautan `?city=…` (bila ada), lalu lokasi terakhir dari
  `localStorage`, lalu Jakarta (`-6.2088, 106.8456`). Setiap kota yang dipilih
  disimpan dan dipulihkan saat halaman dibuka kembali.
- **Tautan yang dapat dibagikan:** memilih kota dari pencarian, geolocation, chip,
  atau kartu kota menulis `?city=<nama>&lat=<lat>&lon=<lon>` (opsional
  `admin1`, `country`, `cc`, `tz`) lewat `history.replaceState`, sehingga tidak
  menambah riwayat dan tombol Back tetap wajar. URL divalidasi saat dibuka
  (nama + koordinat dalam rentang); `?city=bandung` tanpa koordinat juga
  dikenali untuk lima kota besar. Tautan URL selalu menang atas
  `localStorage`. Boot default tidak menambahkan parameter.
- **Pencarian:** autocomplete dengan debounce 300 ms. Minimal 2 karakter,
  navigasi panah atas/bawah, Enter untuk memilih, Escape untuk menutup.
  Hasil `country_code === ID` diprioritaskan. Jika kota tidak ditemukan,
  muncul pesan jelas + 3 saran kota besar; kota yang sedang aktif tidak berubah.
- **Geolocation:** tombol **Lokasi Saya** memakai Position API + reverse geocode
  BigDataCloud (cache 24 jam). Penolakan, timeout, atau lokasi tidak tersedia
  menghasilkan toast informatif, fokus kembali ke input pencarian, dan **kota
  aktif tidak berubah**.
- **Cuaca terkini:** suhu, terasa seperti, kelembapan, angin (km/j), UV, kondisi
  WMO, ikon siang/malam, serta `Diperbarui HH.mm` sesuai timezone lokasi.
- **Prakiraan:** lima kartu harian (kode cuaca, maks/min, peluang hujan).
- **Lima kota besar:** Jakarta, Surabaya, Bandung, Medan, Makassar dimuat dengan
  `Promise.allSettled`. Satu kota gagal hanya menampilkan tombol **Coba lagi**
  pada kartunya sendiri.
- **Peta Windy:** iframe dimuat lazy saat mendekati layar, layer Angin/Hujan/
  Suhu/Awan memakai debounce 250 ms, dan fallback muncul jika iframe tidak
  merespons dalam 10 detik. Timeline memakai kontrol bawaan Windy di bawah peta;
  legenda mengikuti lapisan dan tidak mengklaim tingkat bahaya.
- **Peringatan dini BMKG:** `GET /api/bmkg/alerts?lang=id|en` mengambil RSS resmi,
  lalu detail CAP untuk setiap item (pool 4, timeout 5 detik/item, anggaran 9
  detik). Proxy menyimpan cache 5 menit dan memakai single-flight agar request
  bersamaan tidak menggandakan beban BMKG. Klien hanya mengirim `lang`; URL
  upstream tidak pernah berasal dari browser.
- **Panel peringatan nasional:** judul `Peringatan Dini Cuaca — Indonesia`, badge
  `Nasional · BMKG`, area + `Berlaku hingga`, tautan CAP resmi, dan teks BMKG
  **verbatim**. Warna aksen severity: Extreme/Severe → merah, Moderate → oranye,
  Minor → kuning, lainnya → slate. Istilah severity resmi selalu ditampilkan.
  Bila kota aktif di luar Indonesia, muncul catatan bahwa cuaca yang ditampilkan
  berbeda dari cakupan peringatan.
- **Relevansi lokal:** `item.area` dibandingkan dengan `location.admin1`
  (normalisasi huruf kecil + buang prefix wilayah). Item yang cocok mendapat
  badge `Relevan dengan lokasi Anda`; item lain tetap tampil dan urutan BMKG
  tidak diubah.
- **Info gempa:** `autogempa.json` (cache 60 detik) dengan fallback
  `gempaterkini.json` (cache 5 menit). Magnitudo, kedalaman, wilayah, waktu, dan
  potensi tsunami ditampilkan sebagai fakta; string waktu BMKG dipertahankan dan
  waktu lokal disediakan sebagai teks sekunder.
- **Bahasa:** ID/EN dengan kamus datar + `t(key, vars)`. Label statis memakai
  hook `data-i18n*`; tanggal memakai `Intl`; pilihan bahasa disimpan di
  `localStorage` (`wjyava-locale`). Beralih ke EN memuat ulang feed alert BMKG
  berbahasa Inggris tanpa menerjemahkan teks resmi BMKG secara manual.
- **Tema gelap/terang:** gelap adalah default; tombol matahari/bulan di navbar
  beralih ke tema terang dan menyimpan pilihan di `localStorage`
  (`wjyava:theme`). Skrip inline di `<head>` menetapkan `data-theme` sebelum
  stylesheet dimuat sehingga tidak ada kedipan (zero-FOUC); `aria-label`,
  `title`, dan `aria-pressed` mengikuti tema serta bahasa aktif. Semua warna
  berasal dari token, termasuk badge severity, kartu gempa, peta, toast, dan
  navbar, dengan kontras WCAG AA di kedua tema.
- **Cache:** geocoding 24 jam, reverse geocode 24 jam, forecast 10 menit, alert
  5 menit, gempa terkini 60 detik, daftar gempa 5 menit, lokasi terakhir 30 hari.
  Cache alert yang lebih tua dari 5 menit tidak dipakai sebagai stale; panel
  masuk degraded mode dengan tautan resmi.
- **Offline:** toast memberi tahu koneksi terputus; panel yang masih punya cache
  tetap menampilkan data tersimpan. Tidak ada reload paksa.

## Performa & aset (audit Fase 4)

Diukur 17 November 2026 dari build lokal (32 modul JS, 6 file CSS):

| Aset | File | Mentah | gzip | brotli |
|---|---:|---:|---:|---:|
| JavaScript kustom (sumber) | 32 | 164,36 KB | 42,43 KB | 35,44 KB |
| JavaScript bundle minified (esbuild, opsional) | 1 | 92,59 KB | 28,72 KB | 24,75 KB |
| CSS kustom | 6 | 65,98 KB | 12,04 KB | 10,22 KB |

**Status target `< 60 KB`:** belum terpenuhi pada ukuran **mentah**. Kamus ID/EN
saja ±30 KB dan panel BMKG ±11 KB; bundle minified tetap 92,59 KB. Target
60 KB terpenuhi pada **payload transfer** — gzip 42,43 KB untuk sumber atau
28,72 KB untuk bundle — dan angka itu yang menentukan waktu muat. Sumber tetap
modular tanpa bundler agar mudah diaudit; tidak ada dependensi runtime baru.

Optimasi yang diterapkan:

- `preconnect` ke fonts, Open-Meteo, geocoding, Windy, BMKG, BigDataCloud, dan
  jsDelivr; `dns-prefetch` untuk Open-Meteo dan BMKG.
- Bootstrap JS `defer`; entry app `type="module"` sehingga tidak ada
  render-blocking JavaScript.
- Iframe Windy baru dibuat setelah `IntersectionObserver` dan memakai
  `loading="lazy"`; logo footer `loading="lazy" decoding="async"`.
- Skeleton menjaga CLS desktop **0,0026** pada pengujian headless.

Bila anggaran 60 KB **mentah** wajib dipenuhi, langkah berikutnya adalah memindah
kamus i18n ke JSON yang di-fetch per locale, memindah label WMO ke data, lalu
mengirim satu bundle minified + chunk lazy untuk panel BMKG (estimasi ±60 KB).
Langkah itu belum diambil karena mengubah arsitektur tanpa bundler yang sudah
diuji pada Fase 0–3.

Perintah reproduksi:

```powershell
# ukuran sumber
Get-ChildItem assets/js -Recurse -Filter *.js | Measure-Object Length -Sum

# bundle minified opsional
npx --yes esbuild assets/js/main.js --bundle --minify --charset=utf8 `
  --format=esm --target=es2020 --outfile="$env:TEMP\app.min.js"
```

## Aturan teknis

- Import relatif **wajib** berekstensi `.js`; tidak ada bundler.
- Data eksternal tidak pernah lewat `innerHTML` — hanya `textContent` /
  helper `core/dom.js`.
- Setiap modul UI subscribe ke slice store miliknya sendiri; pembaruan cuaca
  tidak pernah me-reload iframe peta.
- Peringatan dini dan info gempa selalu berskala **nasional Indonesia**.
- Setiap panel menampilkan sumber + waktu pembaruan.
- URL lokasi ditulis hanya lewat `history.replaceState`; tidak ada entri riwayat
  baru dan URL pengguna tidak pernah dipakai sebagai endpoint API.
- Proxy hanya menerima `lang`; whitelist host + regex path mencegah SSRF, dan
  redirect hanya diizinkan ke host BMKG yang sama.

## Kredit data

- Cuaca & prakiraan: [Open-Meteo](https://open-meteo.com/)
- Peringatan dini & gempa: [BMKG](https://www.bmkg.go.id/)
- Reverse geocode: [BigDataCloud](https://www.bigdatacloud.com/)
- Peta: [Windy.com](https://www.windy.com/) · ECMWF

Dokumen arsitektur lengkap ada di [PLAN.md](PLAN.md). Kontrak endpoint dan
matriks uji ada di [docs/api-contract.md](docs/api-contract.md) serta
[docs/test-checklist.md](docs/test-checklist.md).
