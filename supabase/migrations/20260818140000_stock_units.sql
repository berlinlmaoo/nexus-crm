-- ==========================================
-- NEXUS CRM — pelacakan stok PER UNIT (serialisasi)
-- ------------------------------------------
-- Sebelum ini satu barang = satu kode = satu barcode, dipakai untuk semua karung. Stiker jadi
-- cuma penunjuk "barang yang mana", bukan penanda barang yang mana SATUNYA — jadi stiker yang
-- disimpen bisa dipakai berkali-kali tanpa ketahuan.
--
-- Sekarang tiap barang fisik punya nomor sendiri: BB-001-0001, BB-001-0002, ... Nomor yang udah
-- keluar nggak bisa dipakai lagi; scanner nolak sambil nyebut kapan dan sama siapa unit itu
-- keluar.
--
-- HUBUNGAN SAMA `products.current_stock`: angka agregatnya TETAP dipegang `stock_transactions`
-- lewat trigger `update_product_stock` yang udah ada. Unit itu lapisan identitas, bukan lapisan
-- angka. Supaya dua lapisan itu nggak pernah beda, tiap operasi unit di bawah SELALU nulis
-- transaksinya sekalian, di dalam satu fungsi yang atomik — bukan dua panggilan terpisah dari
-- aplikasi.
-- ==========================================

CREATE TABLE IF NOT EXISTS public.stock_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

    -- Nomor yang dicetak di stiker. UNIQUE se-database, bukan cuma se-barang: nomor ini yang
    -- diketik/discan orang, dan kalau bisa kembar antar barang, satu scan jadi ambigu.
    serial VARCHAR(40) NOT NULL UNIQUE,

    -- Urutan ke berapa untuk barang ini. Disimpan sebagai angka, bukan diambil dari parsing
    -- teks serial, supaya nomor berikutnya nggak perlu nebak-nebak format.
    seq INTEGER NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK'
        CHECK (status IN ('IN_STOCK', 'USED', 'WASTED')),

    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    received_ref VARCHAR(100),

    consumed_at TIMESTAMPTZ,
    consumed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    consumed_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT stock_units_product_seq_key UNIQUE (product_id, seq)
);

-- Pertanyaan yang paling sering ditanya ke tabel ini: "barang X masih ada berapa unit di gudang".
CREATE INDEX IF NOT EXISTS idx_stock_units_product_status
    ON public.stock_units USING btree (product_id, status);

ALTER TABLE public.stock_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read stock_units" ON public.stock_units;
CREATE POLICY "staff read stock_units" ON public.stock_units
    FOR SELECT TO authenticated USING (public.is_active_staff());


-- ------------------------------------------------------------------
-- mint_stock_units() — barang datang: bikin N unit baru + catat transaksi IN.
--
-- Penomorannya dikunci pakai advisory lock per barang, bukan "SELECT max(seq)+1" polos: dua
-- orang yang nerima kiriman barang yang sama di detik yang sama bakal ngitung max yang sama dan
-- salah satunya gagal. Dikunci per barang (bukan global) supaya penerimaan barang berbeda tetap
-- bisa jalan barengan.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mint_stock_units(
    p_product UUID,
    p_count   INTEGER,
    p_user    UUID,
    p_ref     TEXT
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
BEGIN
    -- Sama polanya kayak submit_opname: auth.uid() ada isinya = yang manggil browser, jadi
    -- pelakunya dia sendiri dan nggak bisa dipalsuin lewat parameter.
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
    -- Batas atas ada karena tiap unit = satu stiker yang harus dicetak dan ditempel manual.
    -- Angka di atas ini hampir pasti salah ketik, bukan kiriman beneran.
    IF p_count > 500 THEN
        RAISE EXCEPTION 'Maksimal 500 unit sekali terima (diminta %)', p_count;
    END IF;

    SELECT code INTO v_code FROM products WHERE id = p_product;
    IF v_code IS NULL THEN
        RAISE EXCEPTION 'Barang nggak ketemu';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('stock_units:' || p_product::text));

    SELECT coalesce(max(seq), 0) + 1 INTO v_mulai FROM stock_units WHERE product_id = p_product;

    WITH baru AS (
        INSERT INTO stock_units (product_id, serial, seq, received_by, received_ref)
        SELECT p_product,
               v_code || '-' || lpad(g::text, 4, '0'),
               g,
               v_user,
               nullif(btrim(coalesce(p_ref, '')), '')
          FROM generate_series(v_mulai, v_mulai + p_count - 1) AS g
        RETURNING serial
    )
    SELECT array_agg(serial ORDER BY serial) INTO v_serials FROM baru;

    -- Satu transaksi IN buat seluruh kiriman: trigger update_product_stock yang naikin
    -- current_stock, jadi angka agregat dan jumlah unit selalu bergerak bareng.
    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes, reference)
    VALUES (p_product, 'IN', p_count, v_user,
            'Terima ' || p_count || ' unit' || coalesce(' (' || nullif(btrim(coalesce(p_ref,'')),'') || ')', ''),
            nullif(btrim(coalesce(p_ref, '')), ''));

    RETURN jsonb_build_object('count', p_count, 'serials', to_jsonb(v_serials));
END;
$$;


-- ------------------------------------------------------------------
-- consume_stock_units() — barang keluar / dibuang, per nomor seri.
--
-- Inilah bagian yang bikin stiker jadi berarti: nomor yang udah keluar ditolak, dan pesannya
-- nyebut kapan dan sama siapa. Semua nomor diperiksa DULU sebelum ada yang diubah — kalau satu
-- nomor bermasalah, nggak ada satu pun yang jalan (bukan setengah keluar setengah nggak).
-- ------------------------------------------------------------------
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

    -- Dikunci duluan biar dua terminal nggak bisa ngeluarin unit yang sama barengan.
    PERFORM 1 FROM stock_units WHERE serial = ANY(p_serials) FOR UPDATE;

    SELECT s AS serial INTO v_bermasalah
      FROM unnest(p_serials) s
     WHERE NOT EXISTS (SELECT 1 FROM stock_units u WHERE u.serial = s)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Nomor unit % nggak terdaftar', v_bermasalah.serial;
    END IF;

    SELECT u.serial,
           u.status,
           to_char(u.consumed_at, 'DD Mon YYYY HH24:MI') AS kapan,
           coalesce(x.name, 'akun terhapus') AS siapa
      INTO v_bermasalah
      FROM stock_units u
      LEFT JOIN users x ON x.id = u.consumed_by
     WHERE u.serial = ANY(p_serials) AND u.status <> 'IN_STOCK'
     LIMIT 1;
    IF FOUND THEN
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

    -- Satu transaksi per BARANG (bukan per unit): riwayat stok tetap kebaca sebagai
    -- "keluar 6 karung", sementara unit mana persisnya ada di stock_units.
    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes)
    SELECT u.product_id, p_type, count(*), v_user,
           coalesce(nullif(btrim(coalesce(p_notes, '')), ''), 'Terminal Scanner ' || p_type)
      FROM stock_units u
     WHERE u.serial = ANY(p_serials)
     GROUP BY u.product_id;

    RETURN jsonb_build_object('count', v_jumlah, 'status', v_status);
END;
$$;


-- EXECUTE dikasih ke authenticated, BUKAN dicabut — lihat penjelasan panjang di
-- 20260818120000_opname_tables.sql: image Postgres ini bikin backend JATUH tiap kali sebuah role
-- kena "permission denied for function", dan `public` itu schema yang diekspos PostgREST.
-- Pengamanannya ada di dalam fungsi (pelaku dari auth.uid(), wajib staff aktif).
REVOKE ALL ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.consume_stock_units(TEXT[], TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_stock_units(TEXT[], TEXT, UUID, TEXT) TO service_role, authenticated;
