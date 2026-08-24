-- ==========================================
-- NEXUS CRM — alur stok nyesuaiin diri ke PO multi-item
-- ------------------------------------------
-- `mint_stock_units()` dan `validate_stock_units()` dibikin waktu satu PO = satu barang, jadi
-- keduanya baca `purchase_orders.quantity`. Sejak PO punya banyak baris, kolom itu NULL buat PO
-- baru — dan pengecekan sisa PO diam-diam nggak jalan sama sekali.
--
-- Sekalian dibenerin satu bug yang kebawa dari versi sebelumnya: waktu ngitung berapa unit yang
-- udah dibikin buat sebuah PO, unit ber-status PENDING NGGAK ikut dihitung. Padahal PENDING itu
-- justru "stikernya udah dicetak, tinggal ditempel" — jatahnya udah kepakai. Akibatnya orang
-- bisa nyetak stiker berkali-kali buat PO yang sama dan tiap kali dibilang masih ada sisa.
-- ==========================================

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
    v_dipesan INTEGER;
    v_dibikin INTEGER;
    v_sisa    INTEGER;
    v_status  TEXT;
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
        SELECT status INTO v_status FROM purchase_orders WHERE id = p_po;
        IF v_status IS NULL THEN
            RAISE EXCEPTION 'PO nggak ketemu';
        END IF;
        -- Barang cuma boleh diterima atas dasar PO yang UDAH disetujui owner. Tanpa cek ini,
        -- PO yang masih nunggu keputusan bisa dipakai buat masukin barang, dan persetujuannya
        -- jadi formalitas kosong.
        IF v_status NOT IN ('APPROVED', 'FULFILLED') THEN
            RAISE EXCEPTION 'PO ini belum disetujui owner (status: %)', lower(v_status);
        END IF;

        -- Jumlah yang dipesan buat BARANG INI. Baris PO bisa lebih dari satu untuk barang yang
        -- sama (dua divisi minta hal yang sama), jadi dijumlahin. `purchase_orders.quantity`
        -- dipakai sebagai cadangan buat PO gaya lama yang belum punya baris.
        SELECT coalesce(sum(i.quantity), 0) INTO v_dipesan
          FROM purchase_order_items i
         WHERE i.po_id = p_po AND i.product_id = p_product;

        IF v_dipesan = 0 THEN
            SELECT CASE WHEN po.product_id = p_product THEN coalesce(po.quantity, 0) ELSE 0 END
              INTO v_dipesan
              FROM purchase_orders po WHERE po.id = p_po;
        END IF;

        IF v_dipesan = 0 THEN
            RAISE EXCEPTION 'PO ini nggak punya baris buat barang tersebut';
        END IF;

        -- SEMUA unit yang udah pernah dibikin buat pasangan PO+barang ini dihitung, termasuk
        -- yang masih PENDING: stikernya udah dicetak, jadi jatahnya udah kepakai.
        SELECT count(*) INTO v_dibikin
          FROM stock_units u
         WHERE u.po_id = p_po AND u.product_id = p_product;

        v_sisa := v_dipesan - v_dibikin;
        IF p_count > v_sisa THEN
            RAISE EXCEPTION 'PO ini sisa % unit lagi buat barang tersebut, nggak bisa terima %',
                greatest(v_sisa, 0), p_count;
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

    -- SENGAJA nggak nulis stock_transactions di sini. Stok baru gerak waktu stikernya ditempel
    -- dan ditembak di Terminal — lihat validate_stock_units().
    RETURN jsonb_build_object('count', p_count, 'serials', to_jsonb(v_serials), 'status', 'PENDING');
END;
$$;


-- validate: penutupan PO dihitung dari TOTAL semua barisnya, bukan po.quantity
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
    v_dipesan    INTEGER;
    v_dateng     INTEGER;
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
       SET status = 'IN_STOCK', validated_at = now(), validated_by = v_user
     WHERE serial = ANY(p_serials);

    GET DIAGNOSTICS v_jumlah = ROW_COUNT;

    INSERT INTO stock_transactions (product_id, type, quantity, user_id, notes, reference)
    SELECT u.product_id, 'IN', count(*), v_user,
           coalesce(nullif(btrim(coalesce(p_notes, '')), ''), 'Validasi barang masuk'),
           max(u.received_ref)
      FROM stock_units u
     WHERE u.serial = ANY(p_serials)
     GROUP BY u.product_id;

    FOR v_po IN
        SELECT DISTINCT po.id
          FROM stock_units u JOIN purchase_orders po ON po.id = u.po_id
         WHERE u.serial = ANY(p_serials) AND po.status <> 'FULFILLED'
    LOOP
        SELECT coalesce(sum(i.quantity), 0) INTO v_dipesan
          FROM purchase_order_items i WHERE i.po_id = v_po.id;
        IF v_dipesan = 0 THEN
            SELECT coalesce(quantity, 0) INTO v_dipesan FROM purchase_orders WHERE id = v_po.id;
        END IF;

        SELECT count(*) INTO v_dateng
          FROM stock_units WHERE po_id = v_po.id AND status <> 'PENDING';

        IF v_dipesan > 0 AND v_dateng >= v_dipesan THEN
            UPDATE purchase_orders SET status = 'FULFILLED' WHERE id = v_po.id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('count', v_jumlah, 'status', 'IN_STOCK');
END;
$$;

REVOKE ALL ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_stock_units(UUID, INTEGER, UUID, TEXT, UUID) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.validate_stock_units(TEXT[], UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_stock_units(TEXT[], UUID, TEXT) TO service_role, authenticated;
