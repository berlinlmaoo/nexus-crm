-- ==========================================
-- NEXUS CRM — Olsera POS integration tables
-- ------------------------------------------
-- These tables are populated out-of-band by the Olsera sync (see the
-- olsera *.mjs scripts). `sales_orders` is the revenue source read by
-- app/api/report/finance — capturing it here so the schema is tracked
-- instead of living only in the cloud/local database.
--
-- Idempotent: CREATE ... IF NOT EXISTS + guarded policies, so this is
-- safe to apply to a database that already has these tables AND to a
-- fresh one. Constraints are inlined in CREATE TABLE so they only apply
-- on first creation.
-- ==========================================

-- 1. sales_orders — one row per Olsera sales order (revenue source for the finance dashboard)
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL DEFAULT 'olsera',
    app_name TEXT NOT NULL,
    external_order_id TEXT NOT NULL,
    order_no TEXT,
    store_id TEXT,
    store_name TEXT,
    order_date TIMESTAMPTZ,
    payment_date TIMESTAMPTZ,
    customer_name TEXT,
    currency_id TEXT DEFAULT 'IDR',
    gross_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    service_charge_amount INTEGER NOT NULL DEFAULT 0,
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    net_amount INTEGER NOT NULL DEFAULT 0,
    payment_type_name TEXT,
    status TEXT,
    status_desc TEXT,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sales_orders_source_app_name_external_order_id_key UNIQUE (source, app_name, external_order_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON public.sales_orders USING btree (order_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_app_name ON public.sales_orders USING btree (app_name);

-- 2. olsera_product_mappings — links an Olsera product id to a Nexus product
CREATE TABLE IF NOT EXISTS public.olsera_product_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name TEXT NOT NULL,
    olsera_product_id TEXT NOT NULL,
    nexus_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT olsera_product_mappings_app_name_olsera_product_id_key UNIQUE (app_name, olsera_product_id)
);

-- 3. olsera_sync_runs — audit log of each Olsera sync execution
CREATE TABLE IF NOT EXISTS public.olsera_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name TEXT NOT NULL,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    total_read INTEGER NOT NULL DEFAULT 0,
    total_created INTEGER NOT NULL DEFAULT 0,
    total_updated INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

-- 4. finance_daily_snapshots — one precomputed finance roll-up per day
CREATE TABLE IF NOT EXISTS public.finance_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    gross_sales INTEGER NOT NULL DEFAULT 0,
    net_sales INTEGER NOT NULL DEFAULT 0,
    discounts INTEGER NOT NULL DEFAULT 0,
    stock_out_value INTEGER NOT NULL DEFAULT 0,
    waste_value INTEGER NOT NULL DEFAULT 0,
    purchase_value INTEGER NOT NULL DEFAULT 0,
    cogs_estimate INTEGER NOT NULL DEFAULT 0,
    gross_profit INTEGER NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    stock_transaction_count INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT finance_daily_snapshots_snapshot_date_key UNIQUE (snapshot_date)
);

-- ==========================================
-- RLS — read for authenticated users (baseline, matches existing tables).
-- The finance API uses the service-role key and bypasses RLS.
-- ==========================================
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olsera_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olsera_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow sales orders read for authenticated" ON public.sales_orders;
CREATE POLICY "Allow sales orders read for authenticated" ON public.sales_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow olsera mappings read for authenticated" ON public.olsera_product_mappings;
CREATE POLICY "Allow olsera mappings read for authenticated" ON public.olsera_product_mappings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow olsera sync runs read for authenticated" ON public.olsera_sync_runs;
CREATE POLICY "Allow olsera sync runs read for authenticated" ON public.olsera_sync_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow finance snapshots read for authenticated" ON public.finance_daily_snapshots;
CREATE POLICY "Allow finance snapshots read for authenticated" ON public.finance_daily_snapshots FOR SELECT TO authenticated USING (true);
