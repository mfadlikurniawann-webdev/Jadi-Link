# Jadi Link

URL shortener dengan analitik klik. Backend NestJS + Fastify, PostgreSQL Neon,
Prisma; frontend Next.js App Router + Tailwind CSS.

## Progres

- [x] Fase 1 — scaffold backend, konfigurasi, schema/migrasi, health check.
- [x] Fase 2 — register, login, JWT guard.
- [x] Fase 3 — CRUD link, ownership, kode otomatis, validasi URL.
- [x] Fase 4 — redirect, cache LRU, buffer klik.
- [x] Fase 5 — analitik.
- [x] Fase 6 — pengujian fitur inti dan alur lengkap, Swagger.
- [x] Fase 7 — frontend Next.js.
- [x] Fase 8 — konfigurasi dan panduan deployment PM2, Nginx, Cloudflare, Vercel.

Repo: [mfadlikurniawann-webdev/Jadi-Link](https://github.com/mfadlikurniawann-webdev/Jadi-Link).
Perubahan setiap fase yang selesai dan lolos verifikasi di-commit dan di-push ke
`origin/main`, tanpa force-push. Workflow tersimpan di `AGENTS.md`.
Secret, `.env`, dependency lokal, dan hasil build tidak dilacak Git.

## Prasyarat

- Node.js **24 LTS** (lihat `.nvmrc`) dan npm.
- Database PostgreSQL, disarankan satu branch Neon **development**.
- Tidak perlu Docker, Redis, atau Nest CLI global.

## Menjalankan backend

Jalankan dari root proyek:

```powershell
cd backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
```

Di macOS/Linux, gunakan `cp .env.example .env` hanya jika `.env` belum ada.
Jangan menimpa `.env` yang sudah berisi kredensial.
Isi `backend/.env`:

| Env | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string **pooled** Neon, dengan `sslmode=verify-full`. |
| `DIRECT_URL` | Connection string **direct** Neon untuk migrasi; boleh dihapus untuk PostgreSQL lokal. |
| `FRONTEND_ORIGIN` | Origin tunggal frontend, tanpa path. Development: `http://localhost:3000`. |
| `SHORT_LINK_BASE_URL` | Origin short link, tanpa path. Development: `http://localhost:3001`. |
| `JWT_SECRET` | Secret acak minimal 32 karakter untuk tanda tangan JWT. |
| `VISITOR_HASH_SECRET` | Secret acak berbeda; digunakan mulai fase 4. |

Generate masing-masing secret secara terpisah:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Jika belum punya database: buat proyek di [Neon Console](https://console.neon.tech),
pilih region terdekat VPS, lalu buka **Connect**. Salin URL dengan pooling aktif
ke `DATABASE_URL` dan URL dengan pooling nonaktif ke `DIRECT_URL`.
Ganti `sslmode=require` menjadi `sslmode=verify-full` pada kedua URL untuk
verifikasi sertifikat TLS yang ketat; pertahankan parameter lain dari Neon.
Jangan mengubahnya menjadi `rejectUnauthorized: false`.
Alamat `YOUR-ENDPOINT...` di `.env.example` hanyalah placeholder, bukan database.

Kemudian:

```sh
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

`prisma:deploy` menerapkan migrasi yang sudah di-commit, tanpa shadow database.
Untuk **perubahan schema berikutnya di development**, gunakan
`npm run prisma:migrate -- --name nama_perubahan` pada database khusus development.
Jangan jalankan `migrate dev` pada production.

Periksa endpoint:

```sh
curl http://localhost:3001/api/health
```

Di Windows PowerShell gunakan `curl.exe` atau
`Invoke-RestMethod http://localhost:3001/api/health`.

Respons 200:

```json
{
  "status": "ok",
  "database": "up",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Health check menjalankan `SELECT 1`, mengembalikan **503** jika database tidak
tersedia, dan tidak membocorkan detail koneksi. Saat startup, env tidak valid
atau koneksi database gagal menyebabkan aplikasi gagal mulai.

## Auth (fase 2)

| Method | Endpoint | Akses | Respons sukses |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Publik, 3 percobaan/menit/IP | 201, user publik dan access token |
| POST | `/api/auth/login` | Publik, 5 percobaan/menit/IP | 200, user publik dan access token |
| GET | `/api/auth/me` | Bearer token | 200, user publik |
| GET | `/api/users/me` | Bearer token | 200, user publik yang sama |
| GET | `/api/health` | Publik | 200 jika database tersedia |

Register/login menerima JSON `email` dan `password`. Email di-trim dan dijadikan
lowercase. Password **tidak di-trim**, minimal 12 karakter saat register,
maksimal **72 byte UTF-8** (bukan 72 karakter Unicode) saat register/login.
Field tambahan ditolak dengan 400. Email duplikat menghasilkan 409.

Contoh respons auth:

```json
{
  "accessToken": "<JWT>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "portfolio@example.com",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

Contoh di PowerShell, khusus akun development (jangan gunakan password contoh
ini untuk akun sungguhan):

```powershell
$api = 'http://localhost:3001/api'
$body = @{
  email = 'portfolio@example.com'
  password = 'portfolio-test-password-123'
} | ConvertTo-Json

$registration = Invoke-RestMethod -Uri "$api/auth/register" `
  -Method Post -ContentType 'application/json' -Body $body
$registration.user

$login = Invoke-RestMethod -Uri "$api/auth/login" `
  -Method Post -ContentType 'application/json' -Body $body

Invoke-RestMethod -Uri "$api/auth/me" `
  -Headers @{ Authorization = "Bearer $($login.accessToken)" }
```

Jika email sudah terdaftar, lewati register dan langsung login. Untuk menguji
guard, panggil `/api/auth/me` tanpa header: respons harus **401**.
Jika terkena **429**, tunggu sampai jendela 60 detik lewat; batas berlaku juga
untuk request tidak valid. Jangan menonaktifkan throttle untuk mengakali tes.

Keputusan auth:

- bcrypt memakai cost **12** dan salt acak. Login email yang tidak ditemukan
  tetap melakukan pembandingan dummy hash agar perbedaan waktu tidak mencolok.
  Email tidak ditemukan/password salah memakai pesan 401 yang sama.
- JWT hanya membawa identitas `sub` serta klaim waktu/issuer/audience.
  Verifikasi membatasi algoritma ke **HS256**, issuer `jadi-link`, audience
  `jadi-link-api`, subject UUID, dan masa berlaku wajib.
  `JWT_EXPIRES_IN_SECONDS` mengatur TTL (default 900 detik).
- Guard global memakai default **private**. Gunakan `@Public()` secara eksplisit
  untuk route publik, termasuk redirect. Guard memverifikasi JWT
  tanpa query database per request; endpoint profil juga memastikan user masih ada.
- `@CurrentUser()` membaca ID yang sudah diverifikasi guard. Untuk ownership
  link, gunakan ID ini, bukan userId yang dikirim client.
- Query create/profil hanya memilih field publik; DTO dengan `@Exclude()` /
  `@Expose()` memberi lapisan tambahan pada serialization. Password hash tidak
  dikembalikan oleh endpoint auth/profil.
- Respons auth/profil memakai `Cache-Control: no-store`. `/api/auth/me` adalah
  pintu pemeriksaan sesi; `/api/users/me` menyediakan resource profil yang sama.
- Hanya access token, belum ada refresh token atau revocation store. Logout
  membuang token di frontend; token yang sudah diterbitkan tetap valid
  sampai kedaluwarsa. Jangan mencetak token atau password ke log.

## Links (fase 3)

Semua endpoint berikut membutuhkan header `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| POST | `/api/links` | Buat link, respons 201. |
| GET | `/api/links?page=1&limit=20` | Daftar link milik user, respons 200. |
| GET | `/api/links/:id` | Detail berdasarkan UUID, respons 200. |
| PATCH | `/api/links/:id` | Ubah tujuan, kedaluwarsa, atau status, respons 200. |
| DELETE | `/api/links/:id` | Hapus link beserta kliknya, respons 204 tanpa body. |

Input create:

- `targetUrl`: wajib, HTTP/HTTPS absolut, maksimal 2048 karakter setelah
  normalisasi. URL dengan username/password, backslash, atau control character
  ditolak. URL disimpan dalam bentuk canonical dari `new URL()`.
- `alias`: opsional, 3–64 karakter, diawali huruf/angka; karakter selanjutnya
  boleh huruf, angka, `_`, `-`. Case-sensitive: `Demo` dan `demo` berbeda.
  Nama route seperti `api`, `docs`, `health`, `auth`, dan `links` direservasi
  tanpa membedakan kapital.
- `expiresAt`: opsional/null, timestamp ISO 8601 dengan waktu dan timezone,
  misalnya `2027-01-01T00:00:00Z`. Jika diisi, harus di masa depan.

Tanpa alias, kode dibuat memakai nanoid: **7 karakter**, alfabet tanpa
`0`, `1`, `i`, `l`, `o`, `I`, `L`, `O`. Database unique index menjadi penentu
akhir saat terjadi request bersamaan. Kode otomatis diulang maksimal **5 kali**
ketika bentrok; jika tetap gagal, respons 503. Alias yang sudah dipakai
menghasilkan 409 tanpa retry.

**Kode/alias dan pemilik tidak dapat diubah setelah create**, sesuai pilihan
desain. PATCH menerima satu atau lebih dari `targetUrl`, `isActive` (boolean),
dan `expiresAt`. Kirim `expiresAt: null` untuk menghapus batas waktu.
Field lain, PATCH kosong, atau ID bukan UUID v4 menghasilkan 400.
Mengaktifkan link tidak otomatis menghapus tanggal kedaluwarsanya.

Ownership diterapkan langsung dalam query database menggunakan `id` + `userId`
dari JWT, termasuk pada UPDATE/DELETE agar tidak ada check-then-write race.
Detail/update/delete milik user lain atau UUID yang tidak ada sama-sama
menghasilkan **404**. Client tidak boleh menentukan `userId`.

Validasi loop membandingkan **hostname** dengan `SHORT_LINK_BASE_URL`, bukan
origin. Mengganti skema, port, kapitalisasi, trailing dot, atau ejaan hostname
percent-encoded tidak dapat melewatinya. Dalam development, jika short hostname
adalah `localhost`, target `http://localhost:3000` juga ditolak.
Tidak ada request HTTP/DNS ke target saat validasi; ini bukan pemeriksaan
ketersediaan halaman atau reputasi tujuan.

Daftar memakai default 20 item, maksimal 100 item per halaman; page 1–10000.
Respons berupa `{ items, page, limit, hasNextPage }`, diurutkan terbaru dahulu
dengan UUID sebagai tie-breaker. Server membaca maksimal `limit + 1` record,
bukan seluruh link atau query COUNT tambahan. Pagination berbasis offset;
penambahan/penghapusan bersamaan dapat menggeser isi halaman.
DTO hanya mengembalikan `id`, `code`, `shortUrl`, `targetUrl`, `isActive`,
`expiresAt`, `createdAt`.

Contoh PowerShell, setelah login pada contoh auth di atas:

```powershell
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$linkBody = @{
  targetUrl = 'https://example.com/article'
  alias = 'portfolio-demo'
  expiresAt = (Get-Date).ToUniversalTime().AddDays(7).ToString('o')
} | ConvertTo-Json

$link = Invoke-RestMethod -Uri "$api/links" -Method Post `
  -Headers $headers -ContentType 'application/json' -Body $linkBody
$link

Invoke-RestMethod -Uri "$api/links?page=1&limit=20" -Headers $headers
Invoke-RestMethod -Uri "$api/links/$($link.id)" -Headers $headers

$update = @{
  targetUrl = 'https://example.com/updated'
  isActive = $false
  expiresAt = $null
} | ConvertTo-Json
Invoke-RestMethod -Uri "$api/links/$($link.id)" -Method Patch `
  -Headers $headers -ContentType 'application/json' -Body $update

Invoke-RestMethod -Uri "$api/links/$($link.id)" -Method Delete -Headers $headers
```

Jika token kedaluwarsa (401), login ulang dan perbarui `$headers`. Jika alias
contoh sudah terpakai (409), ganti alias atau hapus link lama milikmu.
Redirect dari `shortUrl`, cache, dan pencatatan klik dijelaskan di fase 4 berikut.

## Redirect dan pencatatan klik (fase 4)

`GET /:code` tersedia **tanpa `/api` dan tanpa token**:

- **302** dengan header `Location` ke URL tujuan untuk link aktif/belum kedaluwarsa.
- **404** untuk kode tidak ditemukan, malformed, atau reserved.
- **410** untuk link nonaktif atau sudah kedaluwarsa.
- **429** setelah 600 request redirect/menit/IP. Auth tetap memakai batas 3/5
  percobaan per menit, dan API lainnya 120 request/menit.

Contoh, setelah membuat link dan menyimpan respons di variabel `$link`:

```powershell
curl.exe -i $link.shortUrl
```

Gunakan **GET** (`-i`), bukan HEAD (`-I`), untuk mencatat klik. Tidak perlu `-L`:
tanpa follow redirect, header 302/Location lebih mudah dilihat. HEAD tetap
mengembalikan header redirect, tetapi tidak dihitung. Hanya GET yang berhasil
302 dicatat; 404/410/429 dan koneksi putus sebelum respons selesai tidak dicatat.
Jika contoh CRUD sebelumnya sudah menghapus `$link`, buat link baru dahulu.

### Cache dan konsistensi

- LRU memakai `Map` bawaan Node, maksimal **1000 entri**, TTL tetap **60 detik**.
  Tidak ada dependency cache tambahan, Redis, negative cache, atau query user
  pada redirect. Record hanya berisi data yang dibutuhkan untuk redirect.
- Tanggal kedaluwarsa diperiksa pada **setiap request**, termasuk cache hit.
  Record nonaktif/kedaluwarsa juga boleh di-cache, tetapi tetap menghasilkan 410.
- Create/update/delete sukses melalui API menginvalidasi kode terkait pada
  cache bersama. Penanda versi mencegah lookup lama yang selesai belakangan
  mengisi ulang nilai stale. Request yang sudah berjalan sebelum mutasi masih
  dapat menyelesaikan redirect lamanya; hasilnya tidak dimasukkan lagi ke cache.
- Cache, throttle, dan buffer berada di **satu proses**. Jalankan satu instance
  PM2; perubahan langsung melalui SQL baru terlihat setelah TTL, bukan
  invalidasi API. Jangan menggunakan PM2 cluster/multi-worker untuk desain ini.
- Redirect dan respons error memakai `Cache-Control: no-store`. Jangan aktifkan
  Cloudflare Cache Everything/Edge TTL yang memaksa cache untuk domain short
  link; bypass cache agar klik dan perubahan link tetap sampai ke backend.
- RedirectModule didaftarkan terakhir. Exclusion global prefix mencocokkan
  template literal `/:code` (colon di-escape), bukan semua route satu segmen,
  agar `/api/health` dan `/api/links` tidak kehilangan prefix.

### Buffer klik

- Setelah event **response `finish`**, metadata disanitasi dan dimasukkan ke
  antrean memory. Redirect **tidak menunggu** INSERT klik atau flush buffer.
- Flush setiap **5 detik**, maksimal **500 event per INSERT**, satu flush
  berlangsung pada satu waktu. Antrean + batch in-flight dibatasi **5000 event**;
  kelebihan event dibuang, bukan menambah memori tanpa batas.
- Jika database gagal, batch ditahan untuk interval berikutnya. UUID event tetap
  dan `skipDuplicates` mencegah duplikasi saat hasil INSERT sebelumnya ambigu.
  Jika link sudah dihapus sebelum flush, event untuk parent yang tidak ada
  disisihkan agar tidak menghambat klik link lainnya.
- Saat shutdown normal, timer dihentikan, Fastify menunggu request selesai,
  lalu hook `onClose` menguras buffer **sebelum Prisma disconnect**.
  Ada satu retry tambahan; kegagalan berkepanjangan tidak diulang tanpa batas.
- Ini **best-effort**, bukan durable queue: SIGKILL/crash, buffer penuh, atau
  database gagal terus dapat menyebabkan kehilangan event. Logger melaporkan
  kegagalan batch dan jumlah event yang dibuang, tanpa payload/IP/secret.
  Jumlah analitik di database bersifat eventual-consistent, biasanya terlambat
  sekitar satu interval flush ditambah waktu query. API analitik dijelaskan berikut.

### Cloudflare dan privasi

- Ambil IP dari `CF-Connecting-IP` **hanya jika socket peer ada di `TRUST_PROXY`**.
  Negara memakai `CF-IPCountry` dari jalur proxy yang sama, dengan CF IP valid;
  `XX`, `T1`, atau metadata tidak valid menjadi null. Tanpa Cloudflare, IP
  fallback mengikuti trust proxy Fastify, atau socket peer langsung.
- Identitas yang sama digunakan untuk throttle, sehingga pengunjung berbeda
  di belakang satu proxy tidak berbagi kuota login. Header CF palsu dari peer
  yang tidak dipercaya diabaikan. `TRUST_PROXY` default hanya Nginx loopback.
- **Proxy yang dipercaya bukan autentikasi Cloudflare.** Di production, batasi
  akses Nginx origin ke jaringan Cloudflare dan pastikan Nginx meneruskan header
  dengan benar; port Node tetap loopback. Lihat [Deployment (fase 8)](#deployment-fase-8).
- `visitorHash` adalah **HMAC-SHA256** dari link ID, IP canonical, dan User-Agent
  yang dibatasi 512 karakter, dengan secret `VISITOR_HASH_SECRET`. Hanya hasil
  hash yang masuk buffer/database; IP mentah dan User-Agent tidak disimpan.
  Hash berbeda antar-link agar tidak memudahkan korelasi lintas link.
- Referrer hanya **hostname**, tanpa path/query/fragment. Device dipetakan
  sederhana ke `mobile`, `tablet`, `desktop`, `bot`, `unknown`; tidak memakai
  library User-Agent/GeoIP besar.
- Hash visitor bukan identitas orang: NAT, IP dinamis, dan perubahan browser
  memengaruhi estimasi unique visitor. Mengganti secret juga mengubah hash.
  Jangan membagikan secret atau mengaktifkan log header mentah.

## Analitik (fase 5)

**`GET /api/links/:id/analytics`** membutuhkan Bearer token dan hanya tersedia
untuk pemilik link. `:id` adalah **UUID link**, bukan kode pendek atau URL tujuan.
Link milik user lain/terhapus/tidak ada menghasilkan 404; ID tidak valid 400;
tanpa token 401. Link nonaktif atau kedaluwarsa tetap dapat dilihat riwayatnya.
Endpoint dibatasi **30 request/menit/IP**, memakai identitas proxy fase 4.

Semua angka hanya berasal dari klik yang **sudah tersimpan**. Request analitik
tidak memaksa flush buffer, agar pembacaan statistik tidak menghambat redirect
atau menunggu antrean INSERT. Respons memakai `Cache-Control: no-store`.

| Field | Definisi |
| --- | --- |
| `linkId` | UUID link yang dianalisis. |
| `period` | `timezone: "UTC"`, `days: 30`, serta `from`/`to` ISO timestamp. |
| `totalClicks` | Seluruh riwayat klik tersimpan sampai `period.to`. |
| `clicksLast30Days` | Klik dari `period.from` sampai `period.to`, inklusif. |
| `uniqueVisitorsLast30Days` | Jumlah hash pengunjung berbeda dalam periode; null/hash kosong diabaikan. |
| `dailyClicks` | Tepat 30 `{ date: "YYYY-MM-DD", clicks }`, urut tanggal naik, hari kosong bernilai 0. |
| `topReferrers` | Maksimal 10 `{ referrer, clicks }` terbesar, memakai hostname saja. |
| `countries` | Seluruh kelompok `{ country, clicks }` pada periode yang sama. |
| `devices` | Lima kelompok `{ device, clicks }`: desktop, mobile, tablet, bot, unknown; termasuk nilai 0. |

Periode menggunakan **30 tanggal kalender UTC**, termasuk hari ini yang masih
berjalan, bukan tepat 720 jam ke belakang. Contoh: pada 26 November 2026 pukul
13:45 UTC, `from` adalah 28 Oktober pukul 00:00 UTC dan `to` adalah 26 November
pukul 13:45 UTC. Record bertanggal masa depan tidak dihitung pada total maupun
breakdown.

Referrer/country null berarti tidak diketahui atau direct/no-referrer.
Country legacy/tidak valid (`XX`, `T1`, dan sebagainya) digabungkan ke null;
device legacy/null ke unknown. Referrer kosong juga masuk null.
Referrer dan negara diurutkan berdasarkan jumlah menurun; jika sama, null
terlebih dahulu, lalu label alfabetis. Karena hanya top 10 referrer, jumlah
klik pada daftar itu dapat lebih kecil dari `clicksLast30Days`.
Semua klik tercatat, termasuk kategori bot; unique visitor adalah estimasi
berbasis hash, bukan hitungan orang atau user login.

Query memakai **satu SQL statement terparameterisasi** via `Prisma.sql`.
Ownership dan seluruh agregat membaca satu snapshot PostgreSQL sehingga
penulisan batch bersamaan tidak menghasilkan total/breakdown dari snapshot
yang berbeda. Hanya hasil agregasi yang dikirim ke Node; tidak memuat seluruh
event ke RAM backend. Index `[linkId, clickedAt]` yang sudah ada melayani filter
link/periode. Bigint COUNT diperiksa batas safe integer sebelum menjadi angka
JSON, bukan dikonversi sembarangan.

**Timezone koneksi:** adapter pg Prisma yang digunakan mengirim parameter
DateTime tanpa offset. Karena itu `PrismaService` menambahkan startup option
`-c TimeZone=UTC` ke setiap koneksi, mempertahankan opsi/SSL lain pada URL.
Ini bukan SET satu kali pada satu koneksi pool dan tidak mengubah default
database secara permanen. Parameter waktu SQL analitik juga memakai ISO dengan
offset `Z` dan cast `timestamptz`, serta pengelompokan `AT TIME ZONE 'UTC'`.
Opsi UTC telah diperiksa kompatibel pada koneksi pooled Neon secara read-only.
Tidak ada perubahan `.env` atau migrasi yang diperlukan; restart backend untuk
memuat konfigurasi koneksi baru.

Contoh PowerShell, setelah login dan membuat link baru seperti contoh sebelumnya:

```powershell
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

# Lihat UUID dan kode link milikmu jika tidak menyimpan respons create.
$myLinks = Invoke-RestMethod -Uri "$api/links" -Headers $headers
$myLinks.items | Select-Object id, code, shortUrl

# $link adalah respons create link. Jangan gunakan URL tujuan sebagai :id.
$stats = Invoke-RestMethod -Uri "$api/links/$($link.id)/analytics" -Headers $headers
$stats | ConvertTo-Json -Depth 6

# Buat satu klik menggunakan GET; jalankan backend di terminal pertama.
curl.exe -i $link.shortUrl
```

Tunggu sekitar satu interval flush (5 detik), lalu ulangi request analitik.
Jika daftar link kosong atau contoh CRUD sudah menghapus `$link`, buat link
baru dahulu. Jika token kedaluwarsa, login ulang dan perbarui `$headers`.
Periode saat ini tetap 30 hari UTC; belum ada filter tanggal/timezone kustom.

## Swagger (fase 6)

Jalankan backend di terminal pertama dengan `npm run start:dev`, lalu buka:

- UI: **http://localhost:3001/docs**
- OpenAPI JSON: **http://localhost:3001/docs/openapi.json**

Urutan mencoba API lewat UI:

1. Jalankan **POST /api/auth/register** atau **POST /api/auth/login**.
2. Salin nilai `accessToken` dari respons.
3. Klik **Authorize**, tempel token saja (tanpa menambahkan `Bearer` lagi).
4. Coba **POST /api/links**, lalu daftar/detail dan endpoint analitik.

Token tidak dipersist ke localStorage oleh Swagger UI. Jangan memasukkan
kredensial production ke dokumentasi development atau membagikan screenshot
yang berisi token/password. Untuk melihat 302 redirect gunakan `curl.exe -i`:
browser/Swagger dapat mengikuti redirect lalu terkena CORS milik situs tujuan.

Dokumentasi memuat:

- DTO input/output, parameter query/UUID, batas UTF-8 password, expiry nullable,
  alias immutable, serta schema nested untuk analitik.
- Bearer security hanya pada endpoint privat; register/login/health/redirect
  tetap publik sesuai implementasi.
- Status 201/200/204/302 serta error envelope yang konsisten, termasuk
  `Location`, `Cache-Control`, dan `Retry-After` yang relevan.

Jika `NODE_ENV=production`, **UI, JSON, dan aset Swagger tidak didaftarkan**.
Jangan menjalankan deployment production dengan `NODE_ENV=development`.
Unit/HTTP test memeriksa bahwa `/docs`, `/docs/openapi.json`, dan aset UI
mengembalikan 404 pada konfigurasi production, sementara health/API tetap hidup.

## Frontend (fase 7)

Jalankan backend seperti panduan di atas pada terminal pertama, port **3001**.
Pada terminal kedua, dari root proyek:

```powershell
cd frontend
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Buka **http://localhost:3000**, lalu buat akun atau masuk. Jangan mengganti
`localhost` menjadi `127.0.0.1` tanpa menyamakan `FRONTEND_ORIGIN` backend:
CORS hanya mengizinkan satu origin yang dikonfigurasi.

`frontend/.env.local` berisi konfigurasi publik, bukan secret:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Nilainya wajib berakhiran `/api`; jangan memasukkan `DATABASE_URL`, password
database, `JWT_SECRET`, atau `VISITOR_HASH_SECRET` ke frontend. Browser
memanggil API Nest langsung, tanpa BFF/proxy Next, sehingga identitas pengunjung
di jalur Cloudflare tetap ditangani backend.

### Fitur dan batas sesi

- Landing page, register/login, workspace privat, daftar link berhalaman
  (20 per halaman), buat/edit, copy, toggle status, dan konfirmasi hapus.
- Alias/kode tetap immutable; edit hanya mengubah tujuan dan kedaluwarsa.
  Batas waktu form mengikuti timezone perangkat dan dikirim sebagai ISO UTC.
- Pencarian, filter status, dan ringkasan dashboard berlaku **untuk halaman
  yang sedang dibuka**, bukan total seluruh link.
- Detail menampilkan total klik, klik/visitor unik 30 hari, grafik SVG,
  tabel harian yang dapat diakses lewat keyboard, serta referrer/negara/device.
  Periode tetap 30 tanggal UTC; klik tersimpan biasanya terlambat sekitar 5 detik.
  Setelah mengunjungi short URL, tunggu lalu klik **Perbarui**.
- Sesi sesuai pilihan pengguna: **hanya di memori React**, bukan cookies,
  localStorage, sessionStorage, URL, atau log. Refresh/full-page navigation,
  tab baru, logout, token kedaluwarsa, atau respons privat 401 meminta login ulang.
  Navigasi internal memakai Next Link agar sesi bertahan.
- Guard frontend hanya mengatur navigasi/tampilan. Backend tetap memverifikasi
  JWT dan ownership setiap request privat. Logout tidak mencabut JWT yang
  sudah diterbitkan; token berlaku sampai expiry backend.
- Antarmuka **Bahasa Indonesia/English** (tombol `ID | EN`). Hanya preferensi
  bahasa yang disimpan di `localStorage`; pesan validasi/error, angka, dan
  tanggal ikut berganti. Default Bahasa Indonesia.
- Respons gagal, loading, daftar kosong, 404, dan batas permintaan ditangani
  di UI. CORS mengekspos `Retry-After` agar browser dapat membaca waktu retry.

### Menguji dan build frontend

Dari `frontend/`, menggunakan Node 24 LTS:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api'
npm run build
npm run start
```

Jika Chrome sudah terpasang, gunakan
`$env:PLAYWRIGHT_CHANNEL = 'chrome'` sebelum `npm run test:e2e` sebagai alternatif
instalasi Chromium. Untuk macOS/Linux, set env dengan
`PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` atau
`NEXT_PUBLIC_API_URL=http://localhost:3001/api npm run build`.

Suite browser otomatis menyalakan frontend pada `127.0.0.1:3100` dan
mengintersep API `127.0.0.1:3101` dengan mock; tidak membutuhkan backend/Neon.
Pastikan port 3100 kosong. Konfigurasi production **wajib** menyebut API secara
eksplisit; host remote harus HTTPS. `NEXT_PUBLIC_API_URL` ditanam pada saat
build: mengubah nilai setelah build tidak mengganti URL di bundle browser.
Build ulang bila domain API berubah. Panduan Vercel ada di bagian deployment.

Struktur frontend:

```text
frontend/
  src/app/             # App Router, layout, halaman auth/workspace
  src/components/      # auth memory-only, shell, modal, komponen UI
  src/features/links/  # dashboard, editor, delete, detail
  src/features/analytics/ # grafik SVG dan breakdown
  src/lib/             # API client, kontrak DTO, validasi, format
  tests/unit/          # Vitest: API, validasi, grafik/format
  tests/e2e/           # Playwright: mock API dan alur browser
```

## Deployment (fase 8)

Konfigurasi siap pakai ada di `deploy/`. Domain asli belum ditentukan, jadi
contoh memakai placeholder; ganti di semua tempat sebelum dipakai.

| Komponen | Tempat | Contoh host |
| --- | --- | --- |
| Frontend Next.js | Vercel | `app.example.com` |
| API (`/api/*`) + short link (`/:code`) | VPS: Nginx → PM2 → Node 24 | `link.example.com` |
| Proxy/TLS publik | Cloudflare (proxied) | `link.example.com` |
| Database | Neon, branch **production** terpisah | — |

```text
deploy/
  pm2/ecosystem.config.cjs          # satu proses fork, shutdown menunggu buffer klik
  nginx/jadi-link.conf              # origin khusus Cloudflare + Authenticated Origin Pulls
  nginx/cloudflare-ips.conf         # snapshot allowlist IP Cloudflare
  scripts/deploy-backend.sh         # pull → build → migrate → prune → reload → health
  scripts/update-cloudflare-ips.sh  # perbarui allowlist, nginx -t, reload
  env/backend.production.env.example
  test/                             # tes kontrak (node --test) + smoke test nginx
```

### 1. VPS (Ubuntu 24.04 LTS)

Sebagai user biasa ber-`sudo`, bukan root:

```sh
sudo apt update && sudo apt install -y nginx git curl
# Node 24 LTS (mis. lewat nvm atau paket NodeSource), lalu:
npm install -g pm2
sudo install -d -o "$USER" /srv/jadi-link
git clone https://github.com/mfadlikurniawann-webdev/Jadi-Link.git /srv/jadi-link
cd /srv/jadi-link
cp deploy/env/backend.production.env.example backend/.env
chmod 600 backend/.env   # isi DATABASE_URL/DIRECT_URL production, domain, dua secret
deploy/scripts/deploy-backend.sh
pm2 startup systemd      # jalankan perintah sudo yang dicetak, lalu:
pm2 save
pm2 install pm2-logrotate
```

`deploy-backend.sh` menolak berjalan bila Node bukan 24, `.env` tidak ada atau
bukan `NODE_ENV=production`, atau ada file terlacak yang diubah di server.
Urutannya: fast-forward `main`, `npm ci`, build (termasuk `prisma generate`),
`prisma migrate deploy`, `npm prune --omit=dev`, reload PM2, lalu menunggu
`/api/health` sampai 20 detik.

PM2 sengaja **satu instance mode fork**: cache redirect, throttle, dan buffer
klik ada di memori satu proses. Restart menyebabkan jeda beberapa detik;
saat `SIGINT`, Fastify menyelesaikan request lalu buffer klik dikuras sebelum
Prisma disconnect (`kill_timeout` 20 detik).

### 2. Cloudflare

1. DNS: record `A`/`AAAA` untuk `link` → IP VPS, status **Proxied**.
2. SSL/TLS → mode **Full (strict)**, aktifkan **Always Use HTTPS**,
   minimum TLS 1.2.
3. SSL/TLS → Origin Server → **Create Certificate** untuk `link.example.com`.
   Simpan di VPS sebagai `/etc/ssl/cloudflare/origin.pem` dan
   `/etc/ssl/cloudflare/origin.key` (`chmod 600`, milik root).
4. **Authenticated Origin Pulls**: unduh CA lalu aktifkan di Cloudflare
   **sebelum** memasang konfigurasi Nginx (Nginx menolak koneksi tanpa sertifikat
   klien dengan 400):

   ```sh
   sudo curl -fsS https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem \
     -o /etc/ssl/cloudflare/authenticated_origin_pull_ca.pem
   ```

5. Caching → Cache Rules: hostname sama dengan `link.example.com` →
   **Bypass cache**. Jangan pakai Cache Everything/Edge TTL untuk host ini;
   klik dan perubahan link harus selalu sampai ke backend.

Allowlist IP saja **bukan** autentikasi, karena rentang IP Cloudflare dipakai
semua pelanggan Cloudflare. Origin baru dipercaya setelah lolos allowlist
**dan** sertifikat klien Authenticated Origin Pulls. Hanya dengan itu header
`CF-Connecting-IP`/`CF-IPCountry` aman dipakai backend.

### 3. Nginx

```sh
cd /srv/jadi-link
sudo deploy/scripts/update-cloudflare-ips.sh        # tulis /etc/nginx/snippets/cloudflare-ips.conf
sudo cp deploy/nginx/jadi-link.conf /etc/nginx/sites-available/jadi-link.conf
sudo sed -i 's/link\.example\.com/HOST-ASLI/g' /etc/nginx/sites-available/jadi-link.conf
sudo ln -s /etc/nginx/sites-available/jadi-link.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Yang dikerjakan konfigurasi ini:

- Hanya IP Cloudflare + sertifikat klien Cloudflare yang dilayani, lainnya `deny`.
- Host tak dikenal ditolak: HTTP `444`, HTTPS menolak handshake.
- `X-Forwarded-For` ditimpa, bukan ditambah, sehingga tidak bisa disisipi klien.
- Body maksimal 64 KiB dan timeout disamakan dengan Fastify.
- Format log tidak mencatat IP pengunjung maupun query string.

Perbarui allowlist berkala, misalnya lewat `sudo crontab -e`:

```cron
0 4 * * 1 /srv/jadi-link/deploy/scripts/update-cloudflare-ips.sh
```

Script menolak daftar yang mencurigakan (kurang dari 10 rentang), menjalankan
`nginx -t`, dan mengembalikan file lama bila validasi gagal.

Firewall: buka SSH, lalu 80/443 hanya untuk rentang Cloudflare:

```sh
sudo ufw allow OpenSSH
for ip in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
  sudo ufw allow proto tcp from "$ip" to any port 80,443
done
sudo ufw enable
```

Periksa: `curl -i https://link.example.com/api/health` → 200; akses langsung
`https://IP-VPS` harus gagal; port 3001 tidak boleh terbuka dari luar.

### 4. Vercel (frontend)

1. Import repo, **Root Directory** `frontend`, framework Next.js,
   Node.js **24.x**.
2. Environment Variable (Production):
   `NEXT_PUBLIC_API_URL=https://link.example.com/api`. Nilai ditanam saat
   build; redeploy setelah mengubahnya.
3. Domain `app.example.com`. Bila DNS di Cloudflare, buat `CNAME` ke target
   yang diberikan Vercel dengan status **DNS only** (awan abu-abu).
4. Samakan `FRONTEND_ORIGIN` backend dengan origin production ini persis.
   CORS hanya mengizinkan satu origin, sehingga **preview deployment**
   (`*.vercel.app`) memang tidak bisa memanggil API production.

### 5. Rilis berikutnya

- Backend: `ssh` ke VPS lalu `/srv/jadi-link/deploy/scripts/deploy-backend.sh`.
- Frontend: Vercel membangun ulang otomatis setiap push ke `main`.
- Migrasi dijalankan sebelum reload, jadi tulis migrasi yang kompatibel dengan
  versi kode sebelumnya. Rollback kode (deploy commit lama) tidak membatalkan
  migrasi secara otomatis.

### Menguji konfigurasi deployment

Dari root repo (Windows/macOS/Linux):

```sh
node --test "deploy/test/*.test.mjs"
```

Di Linux yang memiliki `nginx`, `openssl`, `curl`, dan `python3`, tanpa root:

```sh
NGINX=/usr/sbin/nginx deploy/test/nginx-smoke.sh
```

Smoke test menjalankan nginx sungguhan di port 18080/18443 dengan sertifikat
sementara dan upstream echo. Yang diperiksa:

- IP non-Cloudflare → 403.
- Tanpa sertifikat klien, atau sertifikat dari CA lain → 400.
- `X-Forwarded-For` palsu ditimpa; header CF diteruskan.
- Body lebih dari 64 KiB → 413.
- Host tak dikenal ditolak; HTTP diarahkan ke HTTPS.
- IP pengunjung tidak masuk access log.

## Kualitas dan build

Di folder `backend/`:

```sh
npm run lint
npm run format:check
npm test
npm run test:e2e
npm run test:cov
npm run build
npm run start:prod
```

Unit test dan HTTP test biasa tidak memerlukan database, karena provider
Prisma di-mock. Test auth tetap menggunakan bcrypt dan JWT sungguhan.
Untuk e2e dengan migrasi dan database asli, jalankan suite integrasi terpisah
di bawah. Suite tersebut tidak termasuk `npm run test:e2e` agar tes cepat tetap
aman dan dapat dijalankan tanpa PostgreSQL.
Build membutuhkan `.env` atau env `DATABASE_URL` untuk membaca konfigurasi
Prisma, tetapi tidak membuka koneksi database. Build menghasilkan `dist/main.js`.

### E2e PostgreSQL sungguhan

Prasyarat: PostgreSQL **lokal** sudah berjalan dan satu role lokal mempunyai
hak **CREATEDB**. Tidak memakai Docker dan jangan menjalankan tes ini di VPS
production atau memakai URL Neon.

Di PowerShell, dari folder `backend/`:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres'
npm run test:integration
Remove-Item Env:TEST_DATABASE_URL
```

Ganti user/password/port sesuai PostgreSQL lokal; URL-encode karakter khusus
pada password. URL tanpa password juga bisa digunakan bila role lokal memakai
trust authentication. Nama database pada URL admin harus `postgres`, tanpa
parameter query. `DATABASE_URL`/`DIRECT_URL` development **tidak** dijadikan
fallback. URL non-loopback, Neon/remote, database aplikasi, atau query override
seperti `?host=...` ditolak sebelum koneksi.

Runner membuat database unik `jadi_link_test_<random>`, mengaplikasikan migrasi
dengan Prisma, mengatur default timezone database uji ke Asia/Bangkok untuk
regresi, lalu menyalakan aplikasi asli dengan koneksi UTC. Hanya database
yang dibuat runner itu yang dihapus setelah aplikasi ditutup, termasuk saat
tes gagal secara normal. Tidak ada penghapusan/reset tabel database pengguna.
Jika proses dibunuh paksa, database sementara bisa tersisa; jangan menghapus
database lain secara massal.

Alur yang diverifikasi:

- register → login → create link → redirect 302 → flush batch → analitik;
- password ter-hash, konflik email/kode memakai constraint PostgreSQL;
- update tujuan menginvalidasi cache, kode tetap sama, delete melakukan cascade;
- buffer dengan parent terhapus tetap dapat dikuras;
- batas UTC 30 hari, unique visitor, null/legacy metadata, dan ownership dua user.

Laporan `npm run test:cov` ada di `backend/coverage/` (diabaikan Git).
Coverage ini **khusus unit test**, bukan gabungan HTTP/integrasi: controller,
bootstrap, dan Swagger diuji melalui suite HTTP. Generator kode, aturan URL,
service links, dan kalkulasi analitik memiliki 100% line coverage unit pada
verifikasi fase 6; itu bukan klaim seluruh aplikasi 100% covered.
Peringatan VM Modules dari Node saat menjalankan Jest adalah normal.

Verifikasi fase 1: **17 unit test + 5 HTTP smoke test** lulus di Node 24 LTS,
termasuk respons 503 dan pembatasan CORS. Migrasi, kesesuaian schema, cascade
Link → Click, dan endpoint health dari hasil build telah diperiksa terhadap
PostgreSQL lokal sementara. Health check terhadap koneksi development Neon
juga sudah dikonfirmasi 200. Database sementara bukan konfigurasi development
yang disimpan.

Verifikasi fase 2: **45 unit test + 22 HTTP test** mencakup register/login,
email normalization, serialization, batas password UTF-8, validasi input,
duplikasi akun, JWT valid/invalid/expired, profil, dan rate limiting.
Alur register → login → profil dari hasil build juga telah diperiksa di Node
24 LTS dengan PostgreSQL lokal sungguhan, termasuk hash bcrypt dan unique
constraint email. Pengujian ini tidak menambahkan akun uji ke Neon.
Tidak ada perubahan schema atau migrasi baru pada fase 2.

Verifikasi fase 3: **124 unit test + 76 HTTP test** (total seluruh fase)
mencakup generator/alfabet, retry bentrokan, batas percobaan, normalisasi URL,
redirect loop, alias reserved, kedaluwarsa, pagination, ownership dua user,
field immutable, dan JWT guard pada seluruh CRUD.
CRUD dua user, perebutan alias bersamaan (201/409), kode yang tetap stabil,
dan cascade Link → Click juga sudah diperiksa dari hasil build di Node 24 LTS
dengan PostgreSQL lokal sungguhan. Akun/data uji dibersihkan setelah verifikasi;
pengujian tidak menulis ke Neon milik pengguna.
Tidak ada perubahan schema atau migrasi baru pada fase 3.

Verifikasi fase 4: **177 unit test + 95 HTTP test** (272 total seluruh fase)
mencakup LRU/TTL, invalidasi dan in-flight lookup, 302/404/410, route prefix,
HEAD, throttle redirect/Cloudflare, privasi metadata, batch size/capacity,
retry idempotent, parent terhapus, timer flush, dan shutdown drain.
Hasil build di Node 24 LTS juga diverifikasi melalui HTTP + PostgreSQL lokal:
klik belum tersimpan sebelum flush, batch tersimpan setelah flush, invalidasi
cache, FK recovery saat link terhapus, serta flush shutdown sebelum Prisma
disconnect. Data uji dibersihkan dan tidak ada penulisan ke Neon pengguna.
Tidak ada perubahan schema, migrasi baru, atau dependency tambahan pada fase 4.

Verifikasi fase 5: **202 unit test + 106 HTTP test** (308 total seluruh fase)
mencakup penghitungan tanggal UTC/leap year/DST, zero-fill, bigint aman, sorting
dan top-10, JWT/ownership, 404, kegagalan database, serta throttle analitik.
SQL asli juga diuji melalui HTTP + PostgreSQL lokal dengan default timezone
non-UTC: batas awal inklusif, klik lama/future, hash berulang/null/kosong,
isolasi dua link/user, fallback country/device, link nonaktif/kedaluwarsa,
top-10 yang seri, dan perubahan statistik setelah flush.
Data uji dibersihkan; tidak ada data aplikasi yang dibaca/ditulis pada Neon
untuk pengujian ini. Cek kompatibilitas Neon hanya menjalankan `SHOW TimeZone`.
Tidak ada perubahan schema, migrasi, atau dependency tambahan pada fase 5.

Verifikasi fase 6 di Node 24 LTS: **212 unit + 117 HTTP + 8 tes pada suite
integrasi**, total **337 tes lulus**. Suite integrasi berisi 2 alur PostgreSQL
asli dan 6 pengecekan pengaman URL database. Swagger UI/aset, schema/security
OpenAPI, dan penonaktifan dokumentasi production sudah diuji melalui HTTP.
Lint, format check, build, dan audit dependency juga lulus.
Tidak ada perubahan schema/migrasi. Dependency Swagger dan static asset
ditambahkan sesuai versi yang kompatibel dengan Nest/Fastify yang terpasang.

Verifikasi fase 7 di Node 24 LTS: frontend **38 unit + 9 tes browser**, backend
**212 unit + 118 HTTP + 8 integrasi**, total **385 tes lulus**. Lint, format
check, typecheck frontend, kedua production build, dan audit dependency lulus.
Tes browser mencakup CRUD, clipboard, tabel/grafik, pagination, error API,
401/expiry, safe return path, refresh logout, ketiadaan token di browser storage,
serta dialog/fokus dan layout mobile dengan email panjang.
Frontend hasil production build juga diperiksa dengan backend asli dan
PostgreSQL lokal terisolasi: register, create, redirect, analitik setelah flush,
edit tujuan/cache, status 410, delete, dan refresh logout; tidak ada uncaught
browser error. Database uji dibuang sesudah tes. Tidak ada penulisan ke Neon,
perubahan schema, migrasi baru, atau konfigurasi deployment pada fase ini.

Verifikasi fase 8: **10 tes kontrak deployment** (`node --test`), backend
**212 unit + 118 HTTP**, format/lint/build backend lulus. Validator env backend
menolak template production mentah (secret placeholder) dan menerimanya setelah
secret diisi. Script lolos `bash -n`; allowlist Cloudflare dibuat dengan
`update-cloudflare-ips.sh` itu sendiri. `nginx-smoke.sh` disiapkan untuk nginx
1.24 (Ubuntu 24.04) tetapi **belum dijalankan** di lingkungan pengembangan ini;
jalankan di Linux sebelum go-live. Deployment ke server sungguhan belum
dilakukan karena domain dan VPS belum ditentukan. Tidak ada perubahan kode
aplikasi, schema, atau migrasi.

## Struktur backend

```text
backend/
  prisma/
    schema.prisma
    migrations/
  src/
    analytics/     # agregasi SQL owner-only, seri UTC, DTO statistik
    auth/          # register/login, bcrypt, JWT, global guard
    common/        # config, filter, cache LRU, identitas proxy, decorator
    health/        # controller → service → Prisma
    links/         # CRUD owner-only, generator kode, aturan URL/alias/expiry
    prisma/        # satu Prisma provider dengan pool terbatas
    redirect/      # redirect publik, metadata klik, buffer batch
    users/         # akses data user, DTO publik, profil
    app.module.ts  # susunan module dan provider global
    main.ts        # bootstrap Fastify
  test/            # HTTP dengan mock DB, kontrak Swagger
    integration/   # e2e dengan PostgreSQL lokal terisolasi
```

## Keputusan dasar

- Module Nest mengelompokkan controller/provider; dependency injection memasok
  service melalui constructor. Komentar singkat tersedia pada bagian khas Nest.
- Prisma 7 menggunakan driver adapter `pg`, dengan maksimal **5 koneksi**
  (dapat diatur 1–10), idle timeout 30 detik, connection timeout 5 detik,
  query timeout 5 detik, serta timezone UTC untuk setiap koneksi.
  Prisma CLI sengaja menjadi runtime dependency agar `prisma migrate deploy`
  tetap tersedia setelah `npm ci --omit=dev` pada fase deployment.
- UUID untuk primary key; waktu menggunakan PostgreSQL `timestamptz`.
  `code @unique` sudah menghasilkan unique index, sehingga tidak diduplikasi.
  Index `[userId, createdAt DESC]` untuk dashboard; `[linkId, clickedAt]` dan
  `[clickedAt]` untuk analitik. Relasi penghapusan memakai cascade.
- Hanya hostname referrer (bukan URL penuh/query) yang direncanakan disimpan.
  Tidak ada kolom IP mentah.
- Helmet, CORS satu origin, ValidationPipe global, serialization interceptor,
  exception filter, serta throttle default 120 request/menit sudah terpasang.
  Serialization user memakai DTO explicit-allowlist, bukan Prisma model mentah.
- Backend bind ke `127.0.0.1` secara default. `TRUST_PROXY` hanya loopback untuk
  Nginx lokal, bukan semua proxy. Pada production port backend tidak boleh
  terbuka ke internet; header Cloudflare perlu diteruskan oleh Nginx dan origin
  dibatasi ke Cloudflare (panduan fase 8).
- Throttle dan hash pengunjung memakai identitas proxy yang sama; header
  Cloudflare hanya dipercaya dari socket peer dalam allowlist `TRUST_PROXY`.
- Override dependency transitive `effect`, `glob`, dan `minimatch` di
  `package.json` memakai versi yang sudah ditambal dan lolos audit keamanan. Override ini
  perlu ditinjau ulang saat dependency induknya diperbarui.
- Jest memakai flag VM modules agar dependency ESM milik Fastify dapat diuji
  dari proyek CommonJS. Peringatan experimental Node saat tes adalah normal.
- `/docs` dan `/docs/openapi.json` hanya tersedia di non-production.
  Domain asli belum ditentukan; ubah env saat sudah tersedia.

Panduan dan konfigurasi deployment ada di bagian Deployment (fase 8) dan folder `deploy/`.
