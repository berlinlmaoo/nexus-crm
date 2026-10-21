# NEXUS CRM

Aplikasi operasional restoran berbasis web untuk mengelola **absensi staf, stok gudang per unit, stok opname, pembelian, dan laporan stok & keuangan** dalam satu tempat.

| | |
|---|---|
| **Framework** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS |
| **Backend** | Supabase — PostgreSQL, Auth, Storage, Row Level Security |
| **Deploy** | Docker (`next build` → `next start`) |

---

## Daftar isi

1. [Fitur](#fitur)
2. [Peran pengguna](#peran-pengguna)
3. [Struktur proyek](#struktur-proyek)
4. [Persiapan](#persiapan)
5. [Menjalankan secara lokal](#menjalankan-secara-lokal)
6. [Deploy produksi](#deploy-produksi)
7. [Data penjualan Olsera](#data-penjualan-olsera)
8. [Keamanan](#keamanan)

---

## Fitur

| Modul | Fungsi |
|---|---|
| **Dashboard** | Ringkasan stok, pembelian, dan aktivitas hari ini |
| **Absensi** | Check-in/out staf dengan lokasi (mobile), log absensi untuk admin |
| **Stok** | Master barang, stok per unit dengan stiker QR, scan QR, penerimaan barang, validasi barang masuk (`PENDING` → `IN_STOCK`) |
| **Stok opname** | Sesi opname yang disimpan secara atomik dan direkonsiliasi per unit |
| **Purchase request → Purchase order** | Request dari tiap bagian digabung menjadi satu PO multi-item; barang hanya bisa diterima setelah PO disetujui Owner |
| **Laporan** | Laporan stok dan keuangan (pendapatan dari data penjualan Olsera), ekspor |
| **Pengguna** | Persetujuan pendaftar baru, pengaturan role |
| **Pengaturan** | Identitas restoran dan logo |

## Peran pengguna

| Role | Akses utama |
|---|---|
| `OWNER` | Semua fitur, persetujuan PO, pengaturan, manajemen pengguna |
| `MANAGER` | Operasional stok, pembelian, laporan |
| `STAFF_GUDANG` | Penerimaan barang, stok, opname |
| `STAFF_DAPUR` | Absensi, purchase request |

Pendaftar baru tidak aktif (`is_active = false`) dan melihat layar menunggu persetujuan sampai diaktifkan oleh Owner/Manager.

## Struktur proyek

```
app/
  (auth)/          halaman login & pendaftaran
  (dashboard)/     halaman aplikasi (attendance, stock, opname, purchasing, report, users, settings, …)
  api/             API route — setiap route memeriksa sesi & role lewat lib/api-auth.ts
components/        komponen UI
lib/               helper Supabase, cek role (api-auth.ts), laporan keuangan
supabase/
  migrations/      skema database, RLS, storage — dijalankan berurutan
scripts/seed.ts    impor awal master barang dari STOK OPNAME.xlsx
UI/                referensi desain layar
Dockerfile         image produksi
```

## Persiapan

**Kebutuhan:** Node.js 20+, npm, dan project Supabase (Supabase Cloud atau self-hosted dengan Supabase CLI/Docker).

1. **Database** — jalankan semua file di `supabase/migrations/` secara berurutan:
   ```bash
   supabase link --project-ref <PROJECT_REF>   # untuk Supabase Cloud
   supabase db push
   ```
   Untuk self-hosted: `supabase init` lalu `supabase start` / `supabase db reset`.

2. **Environment** — salin `.env.local.example` menjadi `.env.local`:

   | Variabel | Keterangan |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL API Supabase yang bisa dijangkau browser **dan** server |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key — **rahasia, hanya untuk server** |

3. **Data awal (opsional)** — impor master barang dari `STOK OPNAME.xlsx`:
   ```bash
   npx tsx scripts/seed.ts
   ```

4. **Akun pertama** — daftar lewat halaman pendaftaran, lalu aktifkan akun tersebut sebagai Owner langsung di database:
   ```sql
   update public.users set role = 'OWNER', is_active = true where email = 'owner@domain-anda.com';
   ```
   Setelah itu Owner/Manager bisa mengaktifkan pengguna lain dari menu Pengguna.

> File konfigurasi lingkungan (`supabase/config.toml`, `cloudflared/config.yml`, kunci, sertifikat, dan file `.env*` asli) **tidak** disimpan di repo dan sudah tercantum di `.gitignore`.

## Menjalankan secara lokal

```bash
npm ci
npm run dev        # http://localhost:3000
```

## Deploy produksi

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.domain-anda.com \
  -t nexus-crm .

docker run -d --name nexus-crm --restart unless-stopped \
  --env-file .env.local -p 3000:3000 nexus-crm
```

`NEXT_PUBLIC_*` dibaca saat build, jadi image perlu di-build ulang setiap kali URL Supabase berubah. Pasang reverse proxy / HTTPS (misalnya Nginx, Caddy, atau Cloudflare Tunnel) di depan port 3000.

## Data penjualan Olsera

Laporan keuangan membaca pendapatan dari tabel `sales_orders` (skemanya ada di migrasi `20260624120000_olsera_integration.sql`). Tabel ini diisi oleh proses sinkronisasi Olsera POS yang berjalan **terpisah dari aplikasi ini** dan tidak termasuk dalam repo. Kredensial Olsera per outlet mengikuti format `.env.olsera.example`.

## Keamanan

- Semua API route wajib memeriksa sesi dan role melalui `requireRole()` (`lib/api-auth.ts`). Jangan menambah route baru tanpa pemeriksaan ini.
- `SUPABASE_SERVICE_ROLE_KEY` menembus RLS: hanya dipakai di server, tidak pernah dikirim ke browser.
- **Supabase self-hosted yang bisa diakses dari internet:** ganti kunci API bawaan Supabase CLI (sama di semua instalasi) dengan kunci acak milik sendiri, lalu pastikan request dengan kunci bawaan ditolak (`401`). Perintah `supabase start` menulis ulang kunci bawaan — ulangi penggantian setiap kali menjalankannya.
- Aktifkan backup database terjadwal.
