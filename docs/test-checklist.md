# Checklist Uji

> **Status: Fase 4 selesai.** Seluruh tahap Fase 0–4 tuntas: cuaca, prakiraan,
> pencarian kota, lima kota besar, peta Windy, peringatan dini BMKG (RSS + CAP),
> info gempa, antarmuka bilingual ID/EN, tautan kota `?city=…`, audit performa,
> disclaimer footer, dan dokumentasi akhir. Tema gelap/terang dengan penyimpanan
> preferensi dan boot zero-FOUC juga tersedia. Matriks error lengkap ada di
> [PLAN.md](../PLAN.md) §8.

## 0. Status tahap

| Fase | Status | Bukti utama |
|---|---|---|
| 0 — Fondasi & kontrak | ✅ selesai | Struktur aset, `PLAN.md`, keputusan arsitektur |
| 1 — Slicing UI | ✅ selesai | 8 section semantik, responsif 360–1440 px, a11y |
| 2 — Open-Meteo + Windy | ✅ selesai | Cuaca live, prakiraan 5 hari, peta, lima kota |
| 3 — BMKG + interaksi | ✅ selesai | Proxy RSS+CAP, panel nasional, gempa, ID/EN, 49/49 QA |
| 4 — Polish & performa | ✅ selesai | URL `?city=`, audit aset, disclaimer, docs, 34/34 QA |
| Tema — Gelap/Terang | ✅ selesai | Toggle navbar, `wjyava:theme`, zero-FOUC, 40/40 QA |

## 1. Menjalankan

```bash
# Terminal 1 — proxy BMKG
cd server
npm install
node index.js            # http://localhost:8787

# Terminal 2 — static site
python -m http.server 5500
# buka http://localhost:5500
```

Halaman harus dibuka lewat HTTP, bukan `file://`, karena memakai ES Modules.
Proxy wajib berjalan agar panel peringatan memuat data; tanpa proxy panel masuk
degraded mode dengan tautan resmi (bukan data rekaan).

## 2. Lingkungan uji

- Chrome **157.0.8103.79** headless via CDP (`Network.setCacheDisabled`).
- Node **v24.21.0**; proxy ESM di `127.0.0.1:8787`, static server Node di
  `127.0.0.1:5501` (aset sama dengan `python -m http.server 5500`; server Node
  dipakai saat QA agar burst 32 modul tidak menabrak backlog server Python).
- `localStorage` dibersihkan di awal setiap skenario.
- Tanggal uji: **17 November 2026**.

## 3. Bukti uji live Fase 3

Hasil otomatis: **49/49 pemeriksaan lulus** (online) dan **5/5 lulus**
(proxy dimatikan).

| Skenario | Hasil |
|---|---|
| Boot tanpa error console | ✅ 0 console error, 0 uncaught exception, 0 network failure |
| Peringatan BMKG | ✅ 8 item, judul `Peringatan Dini Cuaca — Indonesia`, subjudul cakupan Indonesia |
| Level & warna severity | ✅ `critical` merah `rgb(239,68,68)`, `warning` oranye `rgb(245,158,11)`, `caution` kuning `rgb(234,179,8)`, `unknown` slate `rgb(100,116,139)` |
| Istilah severity | ✅ kata resmi (`Moderate`) tetap tampil di setiap kartu |
| Detail CAP | ✅ `Wilayah` + `Berlaku hingga 17 Nov, 14.00 WITA` + tautan `.../CKS20261117001_alert.xml` |
| Sumber & badge | ✅ `Sumber: BMKG · 17 Nov, 11.01 WIB` + badge `Nasional · BMKG` |
| Stale badge saat fresh | ✅ tidak muncul (`stale: false`) |
| Gempa terkini | ✅ `4,8 M`, `Pusat gempa berada di laut 49 km timur laut Ruteng, Manggarai`, baris Kedalaman/Waktu/Potensi/Dirasakan, sumber BMKG |
| Ganti bahasa EN | ✅ `lang="en"`, `localStorage=wjyava-locale=en`, nav `Weather`, hero English, alert refetch ke `Weather Warnings — Indonesia` |
| Teks BMKG di EN | ✅ headline asli feed EN (`Thunderstorm This Afternoon in Kalimantan Selatan`) tidak diterjemahkan klien |
| Kembali ke ID | ✅ feed ID dimuat ulang, label Indonesia |
| Kota luar negeri | ✅ `Singapore` → cuaca Singapore, catatan nasional muncul, 8 alert BMKG tetap, panel gempa tidak berubah |
| Geolocation ditolak | ✅ toast `Izin lokasi ditolak…`, fokus ke `#city-input`, judul/kota aktif tetap Singapore |
| FAQ keyboard | ✅ Enter membuka `#faq2`, ArrowDown memindahkan fokus ke `#faq3` |
| Validasi kontak | ✅ pesan error email + pesan, fokus ke `contact-email` |
| ScrollSpy | ✅ scroll ke `#peta` → link aktif `#peta` + `aria-current="true"` |
| CLS desktop | ✅ **0.0078** (< 0.1) |
| Overflow horizontal | ✅ 0 px pada 360, 390, 768, dan 1440 px |
| Kartu alert di mobile | ✅ lebar 290 px @360, 320 px @390, 657 px @768 — tidak melebihi viewport |
| Proxy dimatikan | ✅ degraded: `Peringatan dini belum dapat dimuat`, 0 item rekaan, badge `Proxy belum dikonfigurasi`, pesan menyebut `http://localhost:8787` |
| Gempa saat proxy mati | ✅ tetap tampil dari `data.bmkg.go.id` |

## 4. Endpoint proxy BMKG

| Uji | Hasil |
|---|---|
| `GET /health` | ✅ 200, `{"ok":true,"cacheEntries":…,"cacheTtlSeconds":300,"maxAlerts":8}` |
| `GET /api/bmkg/alerts?lang=id` | ✅ 200, 8 item, `language=id`, `scope=national`, `stale=false`, `degraded=false` |
| Panggilan ID kedua | ✅ 200 dalam **105 ms**, ETag sama, ukuran 9058 B |
| `GET /api/bmkg/alerts?lang=en` | ✅ 200, 8 item, feed English, 9016 B |
| `GET /api/bmkg/alerts?lang=xx` | ✅ 400 `invalid_language` |
| CORS | ✅ `Access-Control-Allow-Origin: *` + `Vary: Origin` |
| ETag/304 | ✅ ETag stabil; `If-None-Match` yang cocok → 304 |
| Cache-Control | ✅ `public, max-age=300` |
| Detail CAP | ✅ `expires` mempertahankan offset `+08:00` / `+07:00` |
| Cold request | ✅ ~1,9 s (ID) dan ~0,7 s (EN); bila RSS melampaui 8 s proxy membalas 502 dan klien melakukan retry |
| RSS 30+ item | ✅ dipotong ke 8 item, urutan BMKG dipertahankan |
| Detail CAP gagal | ✅ item tetap tampil dengan `detailStatus: "unavailable"` |

## 5. Struktur & aset

- [x] Halaman memuat tanpa error di console.
- [x] 8 section tampil berurutan: Navbar, Hero + Cuaca, Prakiraan, Peta, Kota, Peringatan & Gempa, Tentang/FAQ/Kontak, Footer.
- [x] Logo, favicon, dan sprite ikon cuaca termuat.
- [x] Tidak ada `mock-data.js`, `demo-render.js`, toolbar demo, atau banner demo di HTML/CSS/JS.
- [x] Preconnect ke Open-Meteo, BigDataCloud, Windy, BMKG, dan jsDelivr tersedia di `<head>`.
- [x] Bootstrap JS memakai `defer`; entry app memakai `type="module"`.
- [x] Iframe Windy memakai `loading="lazy"`; logo footer `loading="lazy" decoding="async"`.
- [x] Ukuran aset tercatat: JS sumber 164,36 KB (32 file), bundle minified 92,59 KB, CSS 65,98 KB; lihat README bagian performa.
- [x] Semua label statis memakai hook `data-i18n`, `data-i18n-placeholder`, atau `data-i18n-aria-label`.

## 6. Pencarian kota

- [x] Debounce 300 ms; query < 2 karakter tidak memicu request.
- [x] Hasil geocoding muncul, dengan hasil `country_code === ID` diprioritaskan.
- [x] Panah atas/bawah memindahkan `aria-activedescendant`; Enter memilih opsi aktif.
- [x] Escape menutup daftar; Tab juga menutup tanpa memilih.
- [x] `requestId` mencegah hasil lama menimpa hasil baru saat mengetik cepat.
- [x] Request yang di-abort tidak di-dedupe dengan request baru.
- [x] Kota tidak ditemukan: pesan jelas + 3 saran statis, kota aktif tidak berubah.
- [x] Memilih saran/quick chip memperbarui hero, prakiraan, peta, dan judul dokumen.
- [x] Pencarian `Singapore` pada Fase 3 memperbarui cuaca tanpa mengubah panel BMKG.

## 7. Cuaca & prakiraan

- [x] Suhu, terasa seperti, kelembapan, angin (km/j), dan UV tampil dari Open-Meteo.
- [x] Kondisi WMO + ikon siang/malam sesuai `is_day`.
- [x] `Diperbarui HH.mm` mengikuti timezone lokasi (`timezone=auto`).
- [x] Lima kartu harian menampilkan kode cuaca, maks/min, dan peluang hujan.
- [x] Tidak ada angka pengganti saat loading/error.
- [x] Tombol Coba lagi pada hero memuat ulang cuaca + prakiraan.

## 8. Lima kota besar

- [x] Jakarta, Surabaya, Bandung, Medan, Makassar dimuat independen (`Promise.allSettled`).
- [x] Lima kartu tampil pada boot Fase 3.
- [x] Satu kota gagal hanya menampilkan error pada kartunya sendiri.
- [x] Retry per kartu hanya memuat ulang kota tersebut.
- [x] `updatedAt` kota diambil dari data terbaru yang berhasil.

## 9. Peta Windy

- [x] Iframe baru dibuat saat panel mendekati viewport (`IntersectionObserver`).
- [x] Chip Angin/Hujan/Suhu/Awan memperbarui overlay + legenda.
- [x] Rebuild iframe di-debounce 250 ms; layer yang sama tidak me-reload iframe.
- [x] Ganti kota memperbarui `lat/lon`, zoom (`5` → `8`), dan judul iframe.
- [x] Iframe gagal dalam 10 detik → fallback + tombol muat ulang + tautan tab baru.
- [x] Timeline memakai kontrol bawaan Windy; tidak ada kontrol timeline eksternal palsu.
- [x] Perubahan data cuaca tidak me-reload iframe (map hanya subscribe `location` + `map`).

## 10. Cache & kegagalan jaringan

- [x] Cache forecast segar dipakai tanpa request jaringan.
- [x] Domain Open-Meteo diblokir → error state per panel, bukan angka rekaan.
- [x] Event `offline` / `online` memunculkan toast, tanpa reload paksa.
- [x] Cache alert ≤5 menit dipakai sebagai stale berlabel **DATA TERSIMPAN** saat proxy gagal.
- [x] Cache alert >5 menit tidak dipakai; panel degraded dengan tautan resmi.
- [x] Proxy dimatikan total → degraded, 0 item rekaan, instruksi `node server/index.js`.
- [x] Gempa memakai `autogempa` → fallback `gempaterkini` → cache stale → error jujur.

## 11. Panel BMKG (nasional)

- [x] Peringatan dini menampilkan item resmi BMKG, bukan placeholder.
- [x] Info gempa menampilkan magnitudo, kedalaman, wilayah, waktu, dan potensi tsunami verbatim.
- [x] Kedua panel berlabel **Nasional · BMKG** dan menampilkan sumber + waktu.
- [x] Kota luar negeri memunculkan catatan bahwa cuaca ≠ cakupan peringatan.
- [x] `item.area` yang cocok dengan `location.admin1` mendapat badge `Relevan dengan lokasi Anda`; item lain tetap tampil.
- [x] Tidak ada request langsung ke RSS BMKG dari browser; hanya proxy yang memanggil RSS/CAP.
- [x] Warna severity tidak pernah menggantikan kata severity resmi.

## 12. Bahasa & geolocation

- [x] ID/EN memakai kamus datar; label statis diterjemahkan tanpa merusak markup.
- [x] `document.documentElement.lang` dan `localStorage.wjyava-locale` diperbarui.
- [x] Tanggal memakai `Intl`; `expires` CAP dengan offset dikonversi ke WIB/WITA/WIT.
- [x] Ganti bahasa memuat ulang feed alert tanpa mengubah data cuaca.
- [x] Teks BMKG tidak diterjemahkan paksa; EN memakai feed `nowcast/en`.
- [ ] Geolocation sukses → reverse geocode + toast nama tempat (uji manual; jalur penolakan sudah diuji otomatis).
- [x] Geolocation ditolak/timeout/unavailable → toast sesuai kode + fokus ke input pencarian.
- [x] Kota aktif tidak berubah saat geolocation gagal.

## 13. Interaksi lanjutan

- [x] ScrollSpy IntersectionObserver menandai section aktif dan `aria-current="true"`.
- [ ] Navigasi mobile menutup menu setelah link dipilih (uji manual).
- [x] FAQ memakai pola WAI-ARIA: Enter membuka, ArrowUp/Down/Home/End memindah fokus (Enter + ArrowDown diuji otomatis).
- [x] `aria-expanded` accordion tetap sinkron.
- [x] Form kontak memvalidasi email + panjang pesan dan memfokuskan kolom pertama yang salah.
- [x] Form kontak memakai `mailto:`; tidak ada data yang dikirim ke server.

## 14. Responsif & CLS

- [x] 360 px: tidak ada scroll horizontal; kartu alert 290 px.
- [x] 390 px: tidak ada scroll horizontal; kartu alert 320 px.
- [x] 768 px: tidak ada scroll horizontal; kartu alert 657 px.
- [x] 1440 px: hero 2 kolom, panel 7/5, footer 3 kolom.
- [x] Mobile: prakiraan menjadi scroll horizontal dengan snap; kota 1 kolom.
- [x] Dropdown pencarian tidak keluar viewport pada 360 px.
- [x] Skeleton memakai tinggi yang sama dengan konten akhir (CLS 0.0078 desktop).
- [x] Badge penjelasan CAP panjang membungkus (`badge--wrap`) dan tidak memperlebar panel.

## 15. Aksesibilitas & keamanan

- [x] Skip-link `#main` berfungsi dengan keyboard.
- [x] Semua kontrol dapat difokuskan; `:focus-visible` terlihat.
- [x] Combobox memakai `role="option"`, `aria-selected`, `aria-expanded`, `aria-activedescendant`.
- [x] Ikon dekoratif `aria-hidden`; tombol punya label.
- [x] `prefers-reduced-motion: reduce` mematikan shimmer/animasi.
- [x] Semua teks eksternal masuk lewat `textContent` / DOM builder, tidak ada `innerHTML`.
- [x] Tautan eksternal memakai `rel="noopener noreferrer"`.
- [x] Import relatif selalu berekstensi `.js`.
- [x] Proxy memakai whitelist host + regex path, redirect manual maksimal 1× ke host yang sama.
- [x] `node --check` lulus untuk **32 file JS klien** dan **5 file JS server**.

## 16. Definition of Done Fase 3

- [x] `curl "http://localhost:8787/api/bmkg/alerts?lang=id"` → 200 JSON valid.
- [x] `lang=en` → feed English; `lang=xx` → 400.
- [x] Panggilan kedua < 50 ms pada cache panas / ~105 ms pada pengukuran HTTP.
- [x] RSS dimatikan → 502 `degraded: true` atau cache stale berlabel.
- [x] Detail CAP gagal → item tetap tampil dengan `detailStatus: "unavailable"`.
- [x] Gempa terkini tampil dengan magnitudo, kedalaman, wilayah, waktu, potensi tsunami verbatim.
- [x] Ganti bahasa memicu refetch alert tanpa mengubah data cuaca.
- [x] Kota luar negeri tetap menampilkan peringatan nasional + catatan eksplisit.
- [x] Geolocation ditolak/timeout tidak mengubah kota aktif.
- [x] Zero console error, zero uncaught exception, zero horizontal overflow.
- [x] Dokumentasi `README.md`, `docs/api-contract.md`, dan checklist ini diperbarui.

## 17. Fase 4 — URL, performa, disclaimer, dokumentasi

Bukti otomatis: **34/34 lulus** (QA Fase 4, Chrome headless via CDP, origin
`127.0.0.1:5501` dengan static server Node agar burst 32 modul tidak menabrak
backlog server Python; aplikasi, aset, dan proxy `127.0.0.1:8787` identik).

| Skenario | Hasil |
|---|---|
| Boot default | ✅ `location.search` kosong, Jakarta |
| Tautan koordinat | ✅ `?city=Bandung&lat=-6.9175&lon=107.6191` → Bandung |
| Hero mengikuti tautan | ✅ cuaca Bandung, bukan Jakarta |
| Tautan slug | ✅ `?city=bandung` → Bandung dari seed |
| Prioritas URL | ✅ Medan menang atas Bandung tersimpan |
| Koordinat invalid | ✅ `lat=999&lon=999` diabaikan, fallback Medan |
| Pencarian | ✅ URL `city=Kota+Bandung&lat=-6.9222&lon=107.6069` |
| Geolocation | ✅ URL `lat=3.5952&lon=98.6722`, label Medan |
| Riwayat | ✅ `history.length` tetap 7 → 7 dan 9 → 9 |
| Parameter lain | ✅ `utm_source=qa` tetap ada setelah URL kota ditulis |
| Reopen tautan | ✅ Bandung dipulihkan meski Surabaya tersimpan |
| Disclaimer ID | ✅ "Prakiraan cuaca dapat berubah… kanal resmi BMKG" |
| Disclaimer EN | ✅ "Weather forecasts can change… official BMKG channels" |
| Preconnect | ✅ 8 host (fonts, Open-Meteo, geocoding, Windy, BMKG, BigDataCloud, jsDelivr) |
| Script | ✅ Bootstrap `defer`, app `type=module` |
| Lazy | ✅ iframe Windy + logo footer |
| CLS / overflow | ✅ 0,0026 / 0 px desktop & 360 px |
| Console | ✅ 0 error, 0 exception, 0 network failure |

## 18. Definition of Done Fase 4

- [x] URL `?city=…` sinkron saat pencarian, geolocation, chip, dan kartu kota.
- [x] URL dibaca saat boot dan menang atas `localStorage`.
- [x] Hanya `history.replaceState`; tidak menambah entri riwayat.
- [x] Koordinat/parameter tidak valid diabaikan dengan fallback aman.
- [x] Preconnect, `defer`/module, dan `loading="lazy"` terpasang.
- [x] Audit ukuran JS/CSS terdokumentasi (target mentah <60 KB belum tercapai;
      gzip 42,43 KB untuk sumber / 28,72 KB untuk bundle).
- [x] Disclaimer footer ID/EN menyebut prakiraan dapat berubah + kanal resmi BMKG.
- [x] `README.md`, `docs/api-contract.md`, dan checklist ini diperbarui.
- [x] `node --check` 32/32 file klien + 5/5 file server.
- [x] Unit `core/url.js` 12/12: parse koordinat/slug, validasi rentang,
      `replaceState`, preservasi `utm_*` + hash, normalisasi `cc`.
- [x] `csstree-validator` 6/6 file CSS, 0 issue.
- [x] QA Fase 3 online 49/49, offline 5/5; QA Fase 4 34/34.
- [x] Zero console error, zero uncaught exception, zero network failure.

## 19. Uji manual residual (opsional, di luar otomatisasi)

- [ ] Offline via DevTools → toast "Koneksi terputus" + data tersimpan bila ada.
- [ ] Blokir domain via DevTools → error state sesuai matriks.
- [ ] HTTP 429 → tidak di-retry, error state + tombol Coba lagi.
- [ ] Keyboard-only penuh: navigasi, cari kota, ganti layer, buka FAQ.
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95.
- [ ] Chrome, Edge, Firefox, Safari (desktop + mobile).

> QA CDP sudah mencakup offline proxy, geolocation ditolak, FAQ keyboard,
> validasi kontak, ScrollSpy, dan layout 360/390/768/1440 px. Item di atas adalah
> validasi browser/perangkat tambahan.

## 20. Pemeriksaan cepat sintaks

```powershell
# Semua modul JavaScript
Get-ChildItem assets/js -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { Write-Host "FAIL $($_.FullName)" }
}

# Import relatif wajib berakhir .js
Select-String -Path assets/js/**/*.js -Pattern "from '\.{1,2}/[^']*[^s]'"

# Cari penggunaan innerHTML
Select-String -Path assets/js/**/*.js,index.html -Pattern 'innerHTML'
```

Hasil akhir Fase 4: **32 file klien** dan **5 file server** lulus
`node --check`; **6 file CSS** lulus `csstree-validator` tanpa issue; tidak ada
`innerHTML` untuk data eksternal (hanya komentar di `core/dom.js` dan
`ui/skeleton.js`).

## 21. Tema Gelap / Terang

Bukti otomatis: **40/40 lulus** (Chrome headless via CDP, origin
`127.0.0.1:5501`). Dark tetap default; light diterapkan lewat
`[data-theme="light"]` pada `<html>` dan disimpan di `localStorage`
(`wjyava:theme`).

| Skenario | Hasil |
|---|---|
| Boot default | ✅ `data-theme="dark"`, `data-bs-theme="dark"`, tanpa nilai tersimpan |
| Light aktif | ✅ `data-theme="light"`, `localStorage=light`, `theme-color=#F2F5FB` |
| Dark kembali | ✅ `data-theme="dark"`, `localStorage=dark`, `theme-color=#0B1020` |
| Zero-FOUC | ✅ skrip inline tema berada sebelum seluruh `<link rel="stylesheet">` |
| Persistensi reload | ✅ tema light bertahan sebelum/ketika boot selesai |
| Aksesibilitas toggle | ✅ `type="button"`, `aria-label`/`title` ID+EN, `aria-pressed` sinkron |
| Ikon | ✅ matahari di dark, bulan di light |
| Kontras badge severity | ✅ AA di kedua tema (light 5,54–8,93:1; dark 7,83–10,92:1) |
| Kontras teks aksen/metrik/peta | ✅ light 4,60–7,09:1 |
| Kontras tombol utama | ✅ 6,29:1 pada light |
| Teks utama | ✅ 16,35:1 light, 15,36:1 dark |
| Layout | ✅ 0 px overflow desktop 1440, mobile 360/390, pada kedua tema |
| Menu mobile | ✅ toggle terlihat dan berada di dalam viewport |
| Console | ✅ 0 error, 0 exception, 0 network failure |
| Regresi Fase 4 | ✅ QA URL/performa 34/34 tetap lulus |
