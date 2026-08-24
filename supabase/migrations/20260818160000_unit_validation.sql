-- ==========================================
-- NEXUS CRM — barang masuk harus DIVALIDASI dulu, dan nyambung ke PO
-- ------------------------------------------
-- Rancangan sebelumnya salah: begitu tombol "Terima & Buat Stiker" dipencet, stoknya langsung
-- kehitung masuk. Padahal di titik itu stikernya belum tentu dicetak, apalagi ditempel — jadi
-- ada unit di database yang nggak punya wujud fisik, dan justru itu yang bikin seluruh gagasan
-- "satu stiker satu barang" bocor dari awal.
--
-- Alurnya sekarang tiga langkah, dan stok baru gerak di langkah ketiga:
--   1. Barang Masuk  → nomor unit lahir dengan status PENDING. Stok TIDAK berubah.
--   2. Cetak & tempel stikernya di barang fisiknya.
--   3. Terminal Stok, mode Barang Masuk → tembak stikernya. Baru di sini status jadi IN_STOCK
--      dan transaksi IN ditulis.
--
-- Efek sampingnya yang berguna: kalau dicetak 50 stiker tapi yang dateng cuma 47, tiga sisanya
-- ketinggalan sebagai PENDING dan kelihatan — bukan diam-diam kehitung sebagai stok.
--
-- Plus: unit bisa nempel ke sebuah PO. Kalau semua barang PO-nya udah divalidasi, PO-nya
-- otomatis ditandai FULFILLED — jadi menu Purchase Order dan gudang nggak lagi dua cerita beda.
-- ==========================================

-- 1. status baru + jejak validasi + sambungan ke PO
ALTER TABLE public.stock_units DROP CONSTRAINT IF EXISTS stock_units_status_check;
ALTER TABLE public.stock_units
    ADD CONSTRAINT stock_units_status_check
    CHECK (status IN ('PENDING', 'IN_STOCK', 'USED', 'WASTED'));

ALTER TABLE public.stock_units ALTER COLUMN status SET DEFAULT 'PENDING';

ALTER TABLE public.stock_units ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE public.stock_units ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.stock_units ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_units_po ON public.stock_units USING btree (po_id);

-- Unit yang udah terlanjur dibikin sebelum aturan ini dianggap sah adanya: mereka lahir di dunia
-- lama yang langsung nulis transaksi IN, jadi stoknya udah kehitung. Nurunin mereka ke PENDING
-- malah bikin angka stok dan jumlah unit nggak cocok.
UPDATE public.stock_units SET validated_at = received_at WHERE status = 'IN_STOCK' AND validated_at IS NULL;


-- 2. mint_stock_units() — sekarang cuma NGELAHIRIN NOMOR. Nggak nyentuh stok sama sekali.
CREATE OR REPLACE FUNCTION public.mint_stock_units(
    p_product UUID,
    p_count   INTEGER,
    p_user    UUID,
    p_ref     TEXT,
    p_po      UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_code    VARCHAR(20);
    v_mulai   INTEGER;
    v_user    UUID;
    v_serials TEXT[];
    v_po_prod UUID;
    v_sisa    INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    IF p_count IS NULL OR p_count < 1 THEN
        RAISE EXCEPTION 'Jumlah unit minimal 1';
    END IF;
    IF p_count > 500 THEN
        RAISE EXCEPTION 'Maksimal 500 unit sekali terima (diminta %)', p_count;
    END IF;

    SELECT code INTO v_code FROM products WHERE id = p_product;
    IF v_code IS NULL THEN
        RAISE EXCEPTION 'Barang nggak ketemu';
    END IF;

    IF p_po IS NOT NULL THEN
        SELECT product_id INTO v_po_prod FROM purchase_orders WHERE id = p_po;
        IF v_po_prod IS NULL THEN
            RAISE EXCEPTION 'PO nggak ketemu';
        END IF;
        IF v_po_prod <> p_product THEN
            RAISE EXCEPTION 'PO itu buat barang lain';
        END IF;

        -- Nggak boleh bikin stiker lebih banyak dari yang dipesan. Kalau kiriman lebih, itu
        -- perkara yang harus diputus orang (tambah PO atau tolak barangnya), bukan diam-diam
        -- dicatat lebih.
        SELECT po.quantity - count(u.id) INTO v_sisa
          FROM purchase_orders po
          LEFT JOIN stock_units u ON u.po_id = po.id AND u.status <> 'PENDING'
         WHERE po.id = p_po
         GROUP BY po.quantity;

        IF v_sisa IS NOT NULL AND p_count > v_sisa THEN
            RAISE EXCEPTION 'PO ini sisa % unit lagi, nggak bisa terima %', v_sisa, p_count;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('stock_units:' || p_product::text));

    SELECT coalesce(max(seq), 0) + 1 INTO v_mulai FROM stock_units WHERE product_id = p_product;

    WITH baru AS (
        INSERT INTO stock_units (product_id, serial, seq, status, received_by, received_ref, po_id)
        SELECT p_product,
               v_code || '-' || lpad(g::text, 4, '0'),
               g,
               'PENDING',
               v_user,
               nullif(btrim(coalesce(p_ref, '')), ''),
               p_po
          FROM generate_series(v_mulai, v_mulai + p_count - 1) AS g
        RETURNING serial
    )
    SELECT array_agg(serial ORDER BY serial) INTO v_serials FROM baru;

    -- SENGAJA nggak ada INSERT ke stock_transactions di sini. Stok baru gerak waktu stikernya
    -- ditempel dan ditembak di Terminal — lihat validate_stock_units().
    RETURN jsonb_build_object('count', p_count, 'serials', to_jsonb(v_serials), 'status', 'PENDING');
END;
$$;


-- 3. validate_stock_units() — inilah titik di mana barang beneran jadi stok.
CREATE OR REPLACE FUNCTION public.validate_stock_units(
    p_serials TEXT[],
    p_user    UUID,
    p_notes   TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user       UUID;
    v_bermasalah RECORD;
    v_jumlah     INTEGER;
    v_po         RECORD;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    IF p_serials IS NULL OR array_length(p_serials, 1) IS NULL THEN
        RAISE EXCEPTION 'Nggak ada nomor unit yang dikirim';
    END IF;

    PERFORM 1 FROM stock_units WHERE serial = ANY(p_serials) FOR UPDATE;

    SELECT s AS serial INTO v_bermasalah
      FROM unnest(p_serials) s
     WHERE NOT EXISTS (SELECT 1 FROM stock_units u WHERE u.serial = s)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Nomor unit % nggak terdaftar', v_bermasalah.serial;
    END IF;

    -- Semua diperiksa dulu; satu nomor bermasalah = nggak ada yang jalan.
    SELECT u.serial, u.status,
           to_char(u.validated_at, 'DD Mon YYYY HH24:MI') AS kapan,
           coalesce(x.name, 'akun terhapus') AS siapa
      INTO v_bermasalah
      FROM stock_units u
      LEFT JOIN users x ON x.id = u.validated_by
     WHERE u.serial = ANY(p_serials) AND u.status <> 'PENDING'
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Unit % %',
            v_bermasalah.serial,
            CASE v_bermasalah.status
                WHEN 'IN_STOCK' THEN 'udah divalidasi ' || coalesce(v_bermasalah.kapan, '') || ' oleh ' || v_bermasalah.siapa
                WHEN 'USED'     THEN 'udah keluar dari gudang'
                ELSE 'udah dibuang'
            END;
    END IF;

    UPDATE stock_units
       SET status = 'IN_STOCK',
           validated_at = now(),
           validated_by = v_user
     WHERE serial = ANY(p_serials);

    GET DIAGNOSTICS v_jumlah = ROW_COUNT;

    -- Satu transaksi IN per barang. Trigger update_product_stock yang naikin current_stock,
    -- jadi angka stok dan jumlah unit IN_STOCK tetap bergerak bareng.
    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes, reference)
    SELECT u.product_id, 'IN', count(*), v_user,
           coalesce(nullif(btrim(coalesce(p_notes, '')), ''), 'Validasi barang masuk'),
           max(u.received_ref)
      FROM stock_units u
     WHERE u.serial = ANY(p_serials)
     GROUP BY u.product_id;

    -- PO yang barangnya udah dateng semua ditutup di sini juga, biar menu Purchase Order dan
    -- gudang nggak jadi dua cerita yang beda.
    FOR v_po IN
        SELECT DISTINCT po.id, po.quantity
          FROM stock_units u JOIN purchase_orders po ON po.id = u.po_id
         WHERE u.serial = ANY(p_serials) AND po.status <> 'FULFILLED'
    LOOP
        IF (SELECT count(*) FROM stock_units WHERE po_id = v_po.id AND status <> 'PENDING') >= v_po.quantity THEN
            UPDATE purchase_orders SET status = 'FULFILLED' WHERE id = v_po.id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('count', v_jumlah, 'status', 'IN_STOCK');
END;
$$;


-- 4. consume_stock_units() — pesannya diperbaiki buat unit yang belum divalidasi.
--    Tanpa ini, nembak stiker yang belum ditempel-dan-divalidasi bakal dibilang "udah dibuang",
--    yang bikin orang gudang nyari masalah yang nggak ada.
CREATE OR REPLACE FUNCTION public.consume_stock_units(
    p_serials TEXT[],
    p_type    TEXT,
    p_user    UUID,
    p_notes   TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user     UUID;
    v_status   VARCHAR(20);
    v_bermasalah RECORD;
    v_jumlah   INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    IF p_type NOT IN ('OUT', 'WASTE') THEN
        RAISE EXCEPTION 'Tipe harus OUT atau WASTE, bukan %', p_type;
    END IF;
    IF p_serials IS NULL OR array_length(p_serials, 1) IS NULL THEN
        RAISE EXCEPTION 'Nggak ada nomor unit yang dikirim';
    END IF;

    PERFORM 1 FROM stock_units WHERE serial = ANY(p_serials) FOR UPDATE;

    SELECT s AS serial INTO v_bermasalah
      FROM unnest(p_serials) s
     WHERE NOT EXISTS (SELECT 1 FROM stock_units u WHERE u.serial = s)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Nomor unit % nggak terdaftar', v_bermasalah.serial;
    END IF;

    SELECT u.serial, u.status,
           to_char(u.consumed_at, 'DD Mon YYYY HH24:MI') AS kapan,
           coalesce(x.name, 'akun terhapus') AS siapa
      INTO v_bermasalah
      FROM stock_units u
      LEFT JOIN users x ON x.id = u.consumed_by
     WHERE u.serial = ANY(p_serials) AND u.status <> 'IN_STOCK'
     LIMIT 1;
    IF FOUND THEN
        IF v_bermasalah.status = 'PENDING' THEN
            RAISE EXCEPTION 'Unit % belum divalidasi masuk. Tembak dulu di mode Barang Masuk.', v_bermasalah.serial;
        END IF;
        RAISE EXCEPTION 'Unit % udah % pada % oleh %',
            v_bermasalah.serial,
            CASE v_bermasalah.status WHEN 'USED' THEN 'keluar' ELSE 'dibuang' END,
            coalesce(v_bermasalah.kapan, '(waktu nggak tercatat)'),
            v_bermasalah.siapa;
    END IF;

    v_status := CASE p_type WHEN 'OUT' THEN 'USED' ELSE 'WASTED' END;

    UPDATE stock_units
       SET status = v_status,
           consumed_at = now(),
           consumed_by = v_user,
           consumed_note = nullif(btrim(coalesce(p_notes, '')), '')
     WHERE serial = ANY(p_serials);

    GET DIAGNOSTICS v_jumlah = ROW_COUNT;

    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes)
    SELECT u.product_id, p_type, count(*), v_user,
           coalesce(nullif(btrim(coalesce(p_notes, '')), ''), 'Terminal Scanner ' || p_type)
      FROM stock_units u
     WHERE u.serial = ANY(p_serials)
     GROUP BY u.product_id;

    RETURN jsonb_build_object('count', v_jumlah, 'status', v_status);
END;
$$;


REVOKE ALL ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT, UUID) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.validate_stock_units(TEXT[], UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_stock_units(TEXT[], UUID, TEXT) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.consume_stock_units(TEXT[], TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_stock_units(TEXT[], TEXT, UUID, TEXT) TO service_role, authenticated;

-- Versi lama mint_stock_units (4 argumen) dibuang biar nggak ada yang kepanggil tanpa sadar
-- dan diam-diam balik ke perilaku "langsung jadi stok".
DROP FUNCTION IF EXISTS public.mint_stock_units(UUID, INTEGER, UUID, TEXT);
