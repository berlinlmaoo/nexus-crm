# NEXUS CRM

CRM operasional restoran: absensi staf, stok (per unit dengan stiker QR), stok opname, purchase request → purchase order, laporan stok & keuangan, serta integrasi penjualan Olsera POS.

Stack: **Next.js** (App Router, TypeScript, Tailwind) + **Supabase** (Postgres, Auth, Storage, RLS).

## Struktur

| Folder | Isi |
|---|---|
| `app/` | Halaman dan API route (`app/api/**`) |
| `components/`, `lib/` | Komponen UI, helper Supabase, `lib/api-auth.ts` (cek role di setiap API) |
| `supabase/migrations/` | Skema database, RLS, storage — jalankan berurutan |
| `scripts/` | Skrip operasional (impor/sinkron Olsera) |
| `UI/` | Referensi desain layar |
| `Dockerfile` | Image produksi (`next build` → `next start`) |

## Konfigurasi

1. Salin `.env.local.example` → `.env.local` dan isi:
   - `NEXT_PUBLIC_SUPABASE_URL` — URL API Supabase yang bisa dijangkau browser **dan** server
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/publishable key
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (**rahasia**, hanya di server)
2. Integrasi Olsera (opsional): salin `.env.olsera.example` → `.env.olsera`, isi kredensial per outlet.
3. File konfigurasi lingkungan **tidak** disimpan di repo:
   - `supabase/config.toml` — buat dengan `supabase init`
   - `cloudflared/config.yml` — hanya jika memakai Cloudflare Tunnel (lihat dokumentasi cloudflared)
   - kunci, sertifikat, dan file `.env*` asli tidak boleh di-commit (sudah ada di `.gitignore`)

## Menjalankan

```bash
npm ci
npm run dev            # http://localhost:3000
```

Database: buat project Supabase (cloud atau self-hosted), lalu jalankan semua file di `supabase/migrations/` berurutan (`supabase db push`, atau lewat SQL editor).

Produksi dengan Docker:

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.contoh.com -t nexus-crm .
docker run -d --env-file .env.local -p 3000:3000 nexus-crm
```

## Catatan keamanan

- Semua API route memeriksa sesi dan role lewat `requireRole()`; jangan menambah route baru tanpa itu.
- Jika Supabase di-self-host dan bisa diakses dari internet, **ganti kunci API bawaan Supabase CLI** (anon/service yang sama di semua instalasi) dengan kunci acak milik sendiri, lalu pastikan request memakai kunci bawaan ditolak (401). `supabase start` akan menulis ulang kunci bawaan — ulangi penggantian setelahnya.
- Service role key menembus RLS: hanya dipakai di server, tidak pernah di browser.
