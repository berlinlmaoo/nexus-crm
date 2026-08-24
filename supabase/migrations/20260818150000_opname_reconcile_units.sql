-- ==========================================
-- NEXUS CRM — opname ikut nyamain jumlah UNIT, bukan cuma angka stok
-- ------------------------------------------
-- Sejak stok dilacak per unit (20260818140000_stock_units.sql), opname yang cuma nyetel
-- `products.current_stock` bikin dua lapisan itu bertengkar: buku bilang 3, tapi masih ada 5
-- baris unit berstatus IN_STOCK. Yang kedua itu yang dipakai scanner, jadi 2 unit "hantu" tetap
-- bisa dikeluarin walaupun barangnya nggak ada.
--
-- Sekarang opname mendamaikan keduanya, di dalam transaksi yang sama:
--   fisik LEBIH SEDIKIT dari unit terdaftar → kelebihannya ditandai hilang, atas nama petugas
--     opname dan nyebut nomor sesinya. Yang ditandai unit dengan nomor terbesar — pilihan yang
--     memang sembarang, karena hitungan per-barang emang nggak bisa nunjukin unit mana yang
--     hilang. Dicatat di consumed_note supaya nggak kelihatan seolah-olah dia beneran keluar.
--   fisik LEBIH BANYAK → ada barang yang belum pernah terdaftar. Unit baru dibikin, DAN
--     stikernya wajib dicetak — kalau nggak, barang itu nggak akan pernah bisa dikeluarin
--     lewat scanner. Nomornya dibalikin di `serials_baru` biar UI bisa langsung nawarin cetak.
-- ==========================================

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
    r             RECORD;
    v_ada         INTEGER;
    v_kurang      INTEGER;
    v_mulai       INTEGER;
    v_code        VARCHAR(20);
    v_baru        TEXT[] := '{}';
    v_tambahan    TEXT[];
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

    INSERT INTO opname_items (session_id, product_id, system_stock, physical_count, selisih)
    SELECT v_session_id,
           (i->>'product_id')::uuid,
           (i->>'system_stock')::int,
           (i->>'physical_count')::int,
           (i->>'physical_count')::int - (i->>'system_stock')::int
      FROM jsonb_array_elements(p_items) i;

    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes, reference)
    SELECT (i->>'product_id')::uuid,
           'OPNAME',
           (i->>'physical_count')::int,
           v_petugas,
           'Stock Opname ' || v_reference || ' — Selisih: ' || ((i->>'physical_count')::int - (i->>'system_stock')::int),
           v_reference
      FROM jsonb_array_elements(p_items) i
     WHERE (i->>'physical_count')::int IS DISTINCT FROM (i->>'system_stock')::int;

    -- ---- damaikan lapisan unit sama hasil hitungan fisik ----
    FOR r IN SELECT (i->>'product_id')::uuid AS pid, (i->>'physical_count')::int AS fisik
               FROM jsonb_array_elements(p_items) i
    LOOP
        PERFORM pg_advisory_xact_lock(hashtext('stock_units:' || r.pid::text));

        SELECT count(*) INTO v_ada FROM stock_units WHERE product_id = r.pid AND status = 'IN_STOCK';

        IF v_ada > r.fisik THEN
            UPDATE stock_units
               SET status = 'USED',
                   consumed_at = now(),
                   consumed_by = v_petugas,
                   consumed_note = 'Hilang saat opname ' || v_reference
             WHERE id IN (
                 SELECT id FROM stock_units
                  WHERE product_id = r.pid AND status = 'IN_STOCK'
                  ORDER BY seq DESC
                  LIMIT (v_ada - r.fisik)
             );

        ELSIF v_ada < r.fisik THEN
            v_kurang := r.fisik - v_ada;
            SELECT code INTO v_code FROM products WHERE id = r.pid;
            SELECT coalesce(max(seq), 0) + 1 INTO v_mulai FROM stock_units WHERE product_id = r.pid;

            WITH baru AS (
                INSERT INTO stock_units (product_id, serial, seq, received_by, received_ref)
                SELECT r.pid, v_code || '-' || lpad(g::text, 4, '0'), g, v_petugas, v_reference
                  FROM generate_series(v_mulai, v_mulai + v_kurang - 1) AS g
                RETURNING serial
            )
            SELECT array_agg(serial ORDER BY serial) INTO v_tambahan FROM baru;

            v_baru := v_baru || coalesce(v_tambahan, '{}');
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'session_id',   v_session_id,
        'reference',    v_reference,
        'total',        v_total,
        'adjusted',     v_selisih,
        'serials_baru', to_jsonb(v_baru)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_opname(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_opname(UUID, TEXT, JSONB) TO service_role, authenticated;
