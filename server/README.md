# WJYAVA — BMKG CORS Proxy

Proxy satu endpoint untuk feed peringatan dini BMKG. Browser tidak pernah
memanggil RSS BMKG secara langsung (feed tidak mengirim header CORS) dan tidak
pernah mengirim URL ke proxy. Rute hanya menerima `lang=id|en`.

## Menjalankan

```bash
cd server
npm install
node index.js
```

Proxy berjalan di `http://localhost:8787`.

```bash
# dari root proyek, di terminal lain
python -m http.server 5500
# buka http://localhost:5500
```

Opsional, salin `.env.example` menjadi `.env` lalu ekspor variabelnya. Proxy
tidak memuat `.env` otomatis (tanpa dependency tambahan), jadi jalankan dengan
environment yang sesuai:

```powershell
$env:ALLOWED_ORIGIN = 'http://localhost:5500'
$env:MAX_ALERTS = '8'
node index.js
```

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `8787` | Port proxy |
| `ALLOWED_ORIGIN` | `*` | Origin CORS yang diizinkan |
| `CACHE_TTL_SECONDS` | `300` | Umur cache in-memory |
| `MAX_ALERTS` | `8` | Jumlah item, dibatasi 5–8 |

## Endpoint

```
GET /api/bmkg/alerts?lang=id|en   → 200 JSON
GET /api/bmkg/alerts?lang=xx      → 400 invalid_language
GET /health                       → 200 status cache
```

Respons sukses:

```json
{
  "source": "BMKG",
  "scope": "national",
  "language": "id",
  "sourceUrl": "https://www.bmkg.go.id/alerts/nowcast/id/rss.xml",
  "updatedAt": "2026-11-16T07:37:14.000Z",
  "fetchedAt": "2026-11-16T08:00:00.000Z",
  "stale": false,
  "items": [
    {
      "headline": "Hujan Lebat disertai Petir di Bali",
      "event": "Hujan Lebat dan Petir",
      "severity": "Moderate",
      "level": "warning",
      "area": "Bali",
      "expires": "2026-11-16T17:30:00+08:00",
      "publishedAt": "2026-11-16T07:25:00.000Z",
      "url": "https://www.bmkg.go.id/alerts/nowcast/id/CBL20261116003_alert.xml",
      "detailStatus": "ok"
    }
  ],
  "degraded": false
}
```

`level` hanya turunan warna: `Extreme`/`Severe` → `critical`,
`Moderate` → `warning`, `Minor` → `caution`, lainnya → `unknown`. Nilai
`severity` resmi selalu disertakan dan ditampilkan apa adanya.

## Perilaku

- **Whitelist ketat:** RSS hanya dua URL resmi; detail CAP hanya
  `https://www.bmkg.go.id/alerts/nowcast/(id|en)/*.xml` lewat regex host+path.
- **Timeout:** RSS 8 detik, detail CAP 5 detik per item, anggaran total 9 detik.
- **Batas ukuran:** 1 MB per dokumen, maksimal 8 item.
- **Detail CAP gagal:** item tetap dikirim dengan `detailStatus: "unavailable"`,
  `severity: null`, `level: "unknown"`, dan deskripsi RSS. Item tidak dibuang.
- **Cache:** 5 menit in-memory dengan single-flight. Jika upstream gagal tetapi
  cache lama tersedia, proxy membalas `200` dengan `stale: true` dan header
  `Warning: 110 - "Response is Stale"`.
- **Gagal total:** `502` dengan
  `{ "error": "upstream_unavailable", "degraded": true, "sourceUrl": "…" }`.
- **ETag:** klien yang mengirim `If-None-Match` menerima `304`.

Tidak ada URL dari klien. Tidak ada logging isi respons penuh.

## Uji manual

```powershell
# 1. Validasi item + detail CAP
curl.exe -s "http://localhost:8787/api/bmkg/alerts?lang=id" | ConvertFrom-Json

# 2. Feed English
curl.exe -s "http://localhost:8787/api/bmkg/alerts?lang=en"

# 3. Bahasa tidak didukung → 400
curl.exe -i "http://localhost:8787/api/bmkg/alerts?lang=xx"

# 4. Cache: panggilan kedua harus cepat (< 50 ms)
Measure-Command { curl.exe -s "http://localhost:8787/api/bmkg/alerts?lang=id" | Out-Null }

# 5. Health
curl.exe -s "http://localhost:8787/health"
```

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `EADDRINUSE` | Port 8787 dipakai | Hentikan proses lain atau set `PORT` |
| Browser: `Failed to fetch` | Proxy belum jalan | `node server/index.js` |
| Browser: CORS error | Origin tidak cocok | Set `ALLOWED_ORIGIN=http://localhost:5500` |
| `502 upstream_unavailable` | BMKG tidak terjangkau | Coba lagi; frontend menampilkan degraded mode |
| Item `detailStatus: "unavailable"` | CAP detail gagal/timeout | Item tetap tampil dengan teks RSS |

Frontend tetap berjalan tanpa proxy: panel peringatan menampilkan degraded mode
dengan tautan resmi BMKG, bukan data rekaan.
