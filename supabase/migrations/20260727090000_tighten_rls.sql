-- Tighten RLS before the app is reachable from the internet.
--
-- The old policies were all `USING (true)`, and three of them were granted to the `public` role —
-- which in Supabase includes `anon`, i.e. anybody holding the anon key. That key is published in
-- the frontend bundle by design, so once the API is exposed those tables would be world-readable
-- AND world-writable: `attendance` and `stock_transactions` both had ALL (insert/update/delete).
--
-- Access model this encodes:
--   * every WRITE already goes through a Next.js API route using SUPABASE_SERVICE_ROLE_KEY, which
--     bypasses RLS — so no browser-facing write policy is needed anywhere.
--   * the browser only ever SELECTs, and only from these four tables (verified in the client
--     components): purchase_orders, users, stock_transactions, products.
--   * nothing is readable before login: no policy targets anon/public any more.

-- ── drop the permissive policies ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for all users" ON attendance;
DROP POLICY IF EXISTS "Enable all access for all users" ON stock_transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON purchase_orders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON restaurant_config;

-- Catch-all: remove ANY remaining policy that targets anon/public on these tables, whatever it was
-- named locally. Without this a stale differently-named policy would silently keep the hole open.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND (roles && ARRAY['anon','public']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    RAISE NOTICE 'dropped anon/public policy % on %', p.policyname, p.tablename;
  END LOOP;
END $$;

-- ── read-only policies for logged-in users, only where the browser actually reads ───────────────
CREATE POLICY "auth read products"           ON products           FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read purchase_orders"    ON purchase_orders    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read stock_transactions" ON stock_transactions FOR SELECT TO authenticated USING (true);
-- restaurant_config drives branding/settings shown in the UI; read-only is enough (writes = API).
CREATE POLICY "auth read restaurant_config"  ON restaurant_config  FOR SELECT TO authenticated USING (true);

-- attendance has NO browser policy on purpose: the check-in page posts to /api/attendance, which
-- uses the service role. Leaving it policy-less means RLS denies every anon/authenticated request.

-- `users` keeps its existing pair (SELECT for authenticated — the purchasing screen resolves
-- requester names — plus self-only UPDATE via auth.uid() = id), so it is left untouched here.

-- Second pass: the originals were named differently than guessed above, so the blanket ALL grants
-- survived. Writes must never be possible straight from the browser — every mutation path in this
-- app goes through an API route on the service role.
DROP POLICY IF EXISTS "Allow purchase orders all for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "Allow restaurant config write for authenticated" ON restaurant_config;
DROP POLICY IF EXISTS "Allow restaurant config read for authenticated" ON restaurant_config;  -- duplicate of "auth read restaurant_config"
