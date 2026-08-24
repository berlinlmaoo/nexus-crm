-- ==========================================
-- NEXUS CRM — tabel Stock Opname yang hilang
-- ------------------------------------------
-- `app/api/opname/route.ts` insert ke `opname_sessions` + `opname_items`, dan halaman
-- /opname, /opname/new, /opname/[ref] baca dari situ — tapi dua tabel itu NGGAK PERNAH
-- dibuat. Jadi selama ini submit hitung fisik selalu gagal 500. Ini yang bikin.
--
-- Kolomnya diambil persis dari yang dipakai route + halamannya, bukan dari tebakan:
--   sessions : reference, petugas_id, notes, total_items, total_discrepancies
--   items    : session_id, product_id, system_stock, physical_count, selisih
--
-- Idempotent (CREATE ... IF NOT EXISTS + policy dijaga DROP dulu), jadi aman diterapkan
-- ke database yang udah punya tabelnya maupun yang masih kosong.
-- ==========================================

-- 1. opname_sessions — satu baris per sesi hitung fisik
CREATE TABLE IF NOT EXISTS public.opname_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Nomor sesi (OPNAME-2026-08-18-437). UNIQUE-nya disengaja: route bikin nomornya pakai
    -- angka acak 100-999, jadi dua opname di hari yang sama bisa dapet nomor kembar. Tanpa
    -- UNIQUE, dua sesi beda bakal keliatan sebagai satu di halaman riwayat dan `reference` di
    -- stock_transactions nunjuk ke dua tempat. Dengan UNIQUE, itu jadi error yang bisa dicoba
    -- ulang — dan route emang nyoba ulang.
    reference VARCHAR(100) NOT NULL UNIQUE,

    -- Petugas yang ngitung. SET NULL, bukan CASCADE: staff resign nggak boleh ngehapus
    -- catatan opname-nya — itu justru bukti angka stok bulan itu dari mana.
    petugas_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    notes TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_discrepancies INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opname_sessions_created_at
    ON public.opname_sessions USING btree (created_at DESC);

-- 2. opname_items — SEMUA barang yang diperiksa di satu sesi, termasuk yang cocok.
--    Yang cocok tetap disimpan supaya "barang ini udah dihitung dan hasilnya pas" bisa
--    dibedain dari "barang ini kelewat nggak dihitung".
CREATE TABLE IF NOT EXISTS public.opname_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.opname_sessions(id) ON DELETE CASCADE,

    -- CASCADE ngikutin FK ke products yang udah ada (stock_transactions, purchase_orders).
    -- Yang jagain riwayat kehapus nggak sengaja itu API-nya: DELETE /api/products/[id] nolak
    -- ngehapus barang yang udah punya riwayat, termasuk baris opname.
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,

    system_stock INTEGER NOT NULL DEFAULT 0,
    physical_count INTEGER NOT NULL DEFAULT 0,
    selisih INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opname_items_session ON public.opname_items USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_opname_items_product ON public.opname_items USING btree (product_id);

-- 3. RLS — ngikutin pola 20260727100000_gate_rls_on_active_user.sql:
--    baca cuma buat staff aktif, dan NOL policy tulis. Semua penulisan lewat route API yang
--    pakai service-role (yang nembus RLS) dan sekarang dijaga requireRole() di kode.
ALTER TABLE public.opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opname_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read opname_sessions" ON public.opname_sessions;
CREATE POLICY "staff read opname_sessions" ON public.opname_sessions
    FOR SELECT TO authenticated USING (public.is_active_staff());

DROP POLICY IF EXISTS "staff read opname_items" ON public.opname_items;
CREATE POLICY "staff read opname_items" ON public.opname_items
    FOR SELECT TO authenticated USING (public.is_active_staff());

-- 4. submit_opname() — satu sesi opname masuk sebagai SATU transaksi database.
--
-- Kenapa dipindah ke sini dari route: route lama nulis tiga kali berturut-turut lewat
-- supabase-js (sesi, lalu item, lalu penyesuaian stok) tanpa transaksi. Kalau langkah ketiga
-- gagal, yang ketinggal adalah sesi opname yang ngaku udah nyesuaikan sekian barang padahal
-- stoknya nggak pernah berubah — dan itu justru kebalikan dari gunanya opname. Body fungsi
-- plpgsql itu atomik: kalau ada satu yang gagal, semuanya batal.
--
-- ⚠️ KENAPA EXECUTE-nya DIKASIH KE `authenticated`, BUKAN DICABUT:
-- image Postgres ini (public.ecr.aws/supabase/postgres:17.6.1.106, PG 17.6) BIKIN BACKEND JATUH
-- setiap kali sebuah role kena "permission denied for function" — bukan error, tapi server
-- putus dan database masuk recovery. Kereproduksi dengan fungsi sepele `SELECT 1` yang nggak
-- ada hubungannya sama file ini, dan bukan gara-gara pgaudit (dites dengan pgaudit.log='none').
-- Karena `public` itu schema yang diekspos PostgREST, mencabut EXECUTE justru bikin siapa pun
-- yang login bisa matiin database berulang kali cuma dengan manggil /rest/v1/rpc/submit_opname.
--
-- Jadi izinnya dikasih, dan pengamanannya dipindah KE DALAM fungsi:
--   * petugasnya diambil dari auth.uid() kalau yang manggil browser — nggak bisa dipalsuin
--     lewat parameter, mau dipanggil dari route API atau langsung ke PostgREST;
--   * yang manggil wajib staff aktif;
--   * angka hitungan divalidasi di sini juga, bukan cuma di route.
-- Ini nggak ngasih kekuatan baru ke staff: mereka emang udah boleh opname lewat aplikasi.
CREATE OR REPLACE FUNCTION public.submit_opname(
    p_petugas UUID,
    p_notes TEXT,
    p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reference   VARCHAR(100);
    v_session_id  UUID;
    v_petugas     UUID;
    v_total       INTEGER;
    v_selisih     INTEGER;
    v_percobaan   INTEGER := 0;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items wajib diisi';
    END IF;

    -- auth.uid() kosong = dipanggil route API pakai service-role (route-nya udah mastiin siapa
    -- yang login). Ada isinya = yang manggil browser yang lagi login, dan petugasnya ya dia.
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_petugas := auth.uid();
    ELSE
        v_petugas := p_petugas;
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_items) i
         WHERE (i->>'product_id') IS NULL
            OR (i->>'physical_count')::int < 0
            OR (i->>'system_stock')::int < 0
    ) THEN
        RAISE EXCEPTION 'Ada baris tanpa produk atau angkanya minus';
    END IF;

    SELECT count(*) INTO v_total FROM jsonb_array_elements(p_items);
    SELECT count(*) INTO v_selisih FROM jsonb_array_elements(p_items) i
     WHERE (i->>'physical_count')::int IS DISTINCT FROM (i->>'system_stock')::int;

    -- Nomor sesi diulang kalau bentrok (angka acaknya cuma 100-999, jadi dua opname di hari
    -- yang sama punya peluang nyata dapet nomor sama).
    LOOP
        v_percobaan := v_percobaan + 1;
        v_reference := 'OPNAME-' || to_char(now(), 'YYYY-MM-DD') || '-' || lpad((100 + floor(random() * 900))::int::text, 3, '0');
        BEGIN
            INSERT INTO opname_sessions (reference, petugas_id, notes, total_items, total_discrepancies)
            VALUES (v_reference, v_petugas, nullif(btrim(coalesce(p_notes, '')), ''), v_total, v_selisih)
            RETURNING id INTO v_session_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            IF v_percobaan >= 10 THEN
                RAISE EXCEPTION 'Gagal bikin nomor opname yang unik setelah % percobaan', v_percobaan;
            END IF;
        END;
    END LOOP;

    -- SEMUA barang yang diperiksa dicatat, termasuk yang cocok — biar "udah dihitung, hasilnya
    -- pas" bisa dibedain dari "kelewat nggak dihitung".
    INSERT INTO opname_items (session_id, product_id, system_stock, physical_count, selisih)
    SELECT v_session_id,
           (i->>'product_id')::uuid,
           (i->>'system_stock')::int,
           (i->>'physical_count')::int,
           (i->>'physical_count')::int - (i->>'system_stock')::int
      FROM jsonb_array_elements(p_items) i;

    -- Stok cuma disentuh buat yang selisih. Tipe OPNAME bikin trigger update_product_stock
    -- nge-SET stok ke `quantity` (bukan nambah), jadi quantity = hasil hitungan fisik.
    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes, reference)
    SELECT (i->>'product_id')::uuid,
           'OPNAME',
           (i->>'physical_count')::int,
           v_petugas,
           'Stock Opname ' || v_reference || ' — Selisih: ' || ((i->>'physical_count')::int - (i->>'system_stock')::int),
           v_reference
      FROM jsonb_array_elements(p_items) i
     WHERE (i->>'physical_count')::int IS DISTINCT FROM (i->>'system_stock')::int;

    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'reference',  v_reference,
        'total',      v_total,
        'adjusted',   v_selisih
    );
END;
$$;

-- anon TIDAK dikasih: yang belum login nggak punya urusan sama opname. Itu artinya jalur
-- "permission denied" masih ada buat anon — tapi anon nggak bisa nyampe sini lewat aplikasi,
-- dan yang bisa manggil PostgREST langsung tanpa login juga kena RLS di semua tabel.
REVOKE ALL ON FUNCTION public.submit_opname(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_opname(UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_opname(UUID, TEXT, JSONB) TO authenticated;
