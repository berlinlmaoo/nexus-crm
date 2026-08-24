-- ==========================================
-- NEXUS CRM — Purchase Request → Purchase Order
-- ------------------------------------------
-- Sebelum ini pengadaan cuma punya satu lapis: siapa pun bikin PO langsung, satu PO = satu
-- barang. Sekarang jadi dua lapis, sesuai cara kerja di lapangan:
--
--   1. PURCHASE REQUEST — tiap head (dapur, gudang, manajemen) ngajuin kebutuhannya sendiri
--      lewat form. Ini permintaan, belum pesanan.
--   2. Manager/Owner lihat semua request di papan, milih beberapa atau semua, terus jadiin
--      SATU PURCHASE ORDER.
--   3. PO itu nunggu persetujuan OWNER sebelum boleh jalan.
--
-- Perubahan bentuk PO: satu PO sekarang punya BANYAK baris (`purchase_order_items`), karena
-- borongan dari beberapa request emang jadi satu pesanan. Kolom `product_id`/`quantity` di
-- `purchase_orders` dijadiin nullable dan ditinggalin buat PO gaya lama — aman, karena saat
-- migrasi ini dibikin tabelnya kosong (nol baris), jadi nggak ada data yang perlu dipindah.
-- ==========================================

-- 1. purchase_requests
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(30) NOT NULL UNIQUE,

    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    estimated_price INTEGER,
    urgency VARCHAR(10) NOT NULL DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL', 'URGENT')),
    notes TEXT,

    -- Pengaju. SET NULL, bukan CASCADE: staff resign nggak boleh ngehapus jejak pengajuannya.
    requester_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Divisi disimpan sebagai SALINAN teks, bukan diambil dari role si pengaju waktu ditampilin.
    -- Kalau orangnya nanti pindah divisi, request lamanya tetap kecatat datang dari divisi yang
    -- waktu itu ngajuin — itu yang bener buat riwayat pengadaan.
    department VARCHAR(30),

    status VARCHAR(20) NOT NULL DEFAULT 'BARU'
        CHECK (status IN ('BARU', 'DIPROSES', 'DITOLAK', 'DIBATALKAN')),
    reject_reason TEXT,

    po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_status ON public.purchase_requests USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_requester ON public.purchase_requests USING btree (requester_id);
CREATE INDEX IF NOT EXISTS idx_pr_po ON public.purchase_requests USING btree (po_id);


-- 2. purchase_order_items — satu PO, banyak baris
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER,
    total_price INTEGER,

    -- Dari request yang mana. Ini yang bikin tiap head bisa nelusurin pengajuannya sampai ke
    -- pesanan — dan kenapa dua divisi yang minta barang sama tetap jadi DUA baris, bukan
    -- digabung: digabung bikin asal-usulnya hilang.
    request_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_po ON public.purchase_order_items USING btree (po_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON public.purchase_order_items USING btree (product_id);


-- 3. purchase_orders: kolom lama jadi opsional, tambah ringkasan
ALTER TABLE public.purchase_orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.purchase_orders ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS total_amount INTEGER;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS reject_reason TEXT;


-- 4. RLS — ngikutin pola tabel lain: baca buat staff aktif, nol policy tulis
--    (semua penulisan lewat route API pakai service-role yang dijaga requireRole()).
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read purchase_requests" ON public.purchase_requests;
CREATE POLICY "staff read purchase_requests" ON public.purchase_requests
    FOR SELECT TO authenticated USING (public.is_active_staff());

DROP POLICY IF EXISTS "staff read purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "staff read purchase_order_items" ON public.purchase_order_items
    FOR SELECT TO authenticated USING (public.is_active_staff());


-- ------------------------------------------------------------------
-- 5. buat_purchase_request() — satu pengajuan dari satu head.
--    Nomornya diurut per hari dan diulang kalau bentrok.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buat_purchase_request(
    p_product  UUID,
    p_qty      INTEGER,
    p_harga    INTEGER,
    p_urgency  TEXT,
    p_notes    TEXT,
    p_user     UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user   UUID;
    v_role   TEXT;
    v_div    TEXT;
    v_no     VARCHAR(30);
    v_id     UUID;
    v_coba   INTEGER := 0;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    IF p_qty IS NULL OR p_qty < 1 THEN
        RAISE EXCEPTION 'Jumlah minimal 1';
    END IF;
    IF p_harga IS NOT NULL AND p_harga < 0 THEN
        RAISE EXCEPTION 'Perkiraan harga nggak boleh minus';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product) THEN
        RAISE EXCEPTION 'Barang nggak ketemu';
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user;
    v_div := CASE v_role
        WHEN 'STAFF_DAPUR'  THEN 'Dapur'
        WHEN 'STAFF_GUDANG' THEN 'Gudang'
        WHEN 'MANAGER'      THEN 'Manajemen'
        WHEN 'OWNER'        THEN 'Owner'
        ELSE 'Lainnya'
    END;

    LOOP
        v_coba := v_coba + 1;
        v_no := 'PR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((100 + floor(random() * 900))::int::text, 3, '0');
        BEGIN
            INSERT INTO purchase_requests
                (request_number, product_id, quantity, estimated_price, urgency, notes, requester_id, department)
            VALUES
                (v_no, p_product, p_qty, p_harga,
                 CASE WHEN upper(coalesce(p_urgency, 'NORMAL')) = 'URGENT' THEN 'URGENT' ELSE 'NORMAL' END,
                 nullif(btrim(coalesce(p_notes, '')), ''), v_user, v_div)
            RETURNING id INTO v_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            IF v_coba >= 10 THEN
                RAISE EXCEPTION 'Gagal bikin nomor request yang unik';
            END IF;
        END;
    END LOOP;

    RETURN jsonb_build_object('id', v_id, 'request_number', v_no);
END;
$$;


-- ------------------------------------------------------------------
-- 6. buat_po_dari_requests() — borongan request jadi SATU PO.
--
--    Semuanya di dalam satu transaksi: PO-nya, barisnya, dan penandaan request-nya. Kalau
--    setengah jalan gagal, yang paling buruk bisa kejadian adalah request kecatat "udah jadi PO"
--    padahal PO-nya nggak ada — dan orang yang ngajuin bakal nungguin barang yang nggak pernah
--    dipesan. Makanya nggak dipecah jadi beberapa panggilan dari aplikasi.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buat_po_dari_requests(
    p_request_ids UUID[],
    p_user        UUID,
    p_notes       TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user  UUID;
    v_role  TEXT;
    v_no    VARCHAR(30);
    v_po    UUID;
    v_coba  INTEGER := 0;
    v_salah RECORD;
    v_total INTEGER;
    v_n     INTEGER;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user;
    IF v_role NOT IN ('OWNER', 'MANAGER') THEN
        RAISE EXCEPTION 'Cuma Manager atau Owner yang boleh nge-PO-in request';
    END IF;

    IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Belum ada request yang dipilih';
    END IF;

    -- Dikunci dulu, biar dua manager yang milih request yang sama barengan nggak bikin dua PO
    -- buat barang yang sama.
    PERFORM 1 FROM purchase_requests WHERE id = ANY(p_request_ids) FOR UPDATE;

    SELECT x AS id INTO v_salah
      FROM unnest(p_request_ids) x
     WHERE NOT EXISTS (SELECT 1 FROM purchase_requests r WHERE r.id = x)
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Ada request yang nggak ketemu';
    END IF;

    SELECT r.request_number, r.status INTO v_salah
      FROM purchase_requests r
     WHERE r.id = ANY(p_request_ids) AND r.status <> 'BARU'
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Request % statusnya udah %, nggak bisa di-PO-in lagi',
            v_salah.request_number, lower(v_salah.status);
    END IF;

    LOOP
        v_coba := v_coba + 1;
        v_no := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((100 + floor(random() * 900))::int::text, 3, '0');
        BEGIN
            INSERT INTO purchase_orders (po_number, status, requester_id, created_by, notes)
            -- Langsung nunggu OWNER: pemborongan ini emang dikerjain Manager/Owner, jadi lapis
            -- persetujuan manager nggak ada gunanya lagi di sini.
            VALUES (v_no, 'PENDING_OWNER', v_user, v_user, nullif(btrim(coalesce(p_notes, '')), ''))
            RETURNING id INTO v_po;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            IF v_coba >= 10 THEN
                RAISE EXCEPTION 'Gagal bikin nomor PO yang unik';
            END IF;
        END;
    END LOOP;

    INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_price, total_price, request_id)
    SELECT v_po, r.product_id, r.quantity, r.estimated_price,
           CASE WHEN r.estimated_price IS NULL THEN NULL ELSE r.estimated_price * r.quantity END,
           r.id
      FROM purchase_requests r
     WHERE r.id = ANY(p_request_ids);

    UPDATE purchase_requests
       SET status = 'DIPROSES', po_id = v_po, updated_at = now()
     WHERE id = ANY(p_request_ids);

    SELECT coalesce(sum(total_price), 0), count(*) INTO v_total, v_n
      FROM purchase_order_items WHERE po_id = v_po;

    UPDATE purchase_orders SET total_amount = v_total WHERE id = v_po;

    RETURN jsonb_build_object('po_id', v_po, 'po_number', v_no, 'items', v_n, 'total', v_total);
END;
$$;


-- ------------------------------------------------------------------
-- 7. putuskan_po() — Owner setuju atau tolak.
--    Ditolak = request-nya balik ke papan sebagai BARU, biar nggak nyangkut di limbo.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.putuskan_po(
    p_po      UUID,
    p_setuju  BOOLEAN,
    p_alasan  TEXT,
    p_user    UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user UUID;
    v_role TEXT;
    v_status TEXT;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT public.is_active_staff() THEN
            RAISE EXCEPTION 'Akun belum diaktifkan';
        END IF;
        v_user := auth.uid();
    ELSE
        v_user := p_user;
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user;
    IF v_role <> 'OWNER' THEN
        RAISE EXCEPTION 'Cuma Owner yang boleh nyetujuin atau nolak PO';
    END IF;

    SELECT status INTO v_status FROM purchase_orders WHERE id = p_po;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'PO nggak ketemu';
    END IF;
    IF v_status NOT IN ('PENDING_OWNER', 'PENDING_MANAGER') THEN
        RAISE EXCEPTION 'PO ini statusnya udah %, nggak nunggu keputusan lagi', lower(v_status);
    END IF;

    IF p_setuju THEN
        UPDATE purchase_orders
           SET status = 'APPROVED', approver_id = v_user, approved_at = now()
         WHERE id = p_po;
    ELSE
        UPDATE purchase_orders
           SET status = 'REJECTED', approver_id = v_user, rejected_at = now(),
               reject_reason = nullif(btrim(coalesce(p_alasan, '')), '')
         WHERE id = p_po;

        -- Request-nya dibalikin ke papan. Kalau dibiarin 'DIPROSES', permintaan yang PO-nya
        -- ditolak bakal ngambang selamanya: nggak jadi pesanan, tapi juga nggak kelihatan lagi
        -- sama yang ngajuin.
        UPDATE purchase_requests
           SET status = 'BARU', po_id = NULL, updated_at = now()
         WHERE po_id = p_po;
    END IF;

    RETURN jsonb_build_object('status', CASE WHEN p_setuju THEN 'APPROVED' ELSE 'REJECTED' END);
END;
$$;


-- Izin: dikasih ke authenticated, BUKAN dicabut — lihat penjelasan panjang di
-- 20260818120000_opname_tables.sql (image Postgres ini crash tiap kali sebuah role kena
-- "permission denied for function"). Pengamanannya ada di DALAM tiap fungsi.
REVOKE ALL ON FUNCTION public.buat_purchase_request(UUID, INTEGER, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buat_purchase_request(UUID, INTEGER, INTEGER, TEXT, TEXT, UUID) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.buat_po_dari_requests(UUID[], UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buat_po_dari_requests(UUID[], UUID, TEXT) TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.putuskan_po(UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.putuskan_po(UUID, BOOLEAN, TEXT, UUID) TO service_role, authenticated;
