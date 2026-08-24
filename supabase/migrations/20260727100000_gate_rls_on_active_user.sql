-- Close the hole the first RLS pass left open.
--
-- Moving the policies from `public` to `authenticated` is only worth something if BECOMING
-- authenticated is controlled — and it isn't: GoTrue here runs with GOTRUE_DISABLE_SIGNUP=false and
-- MAILER_AUTOCONFIRM=true, so anybody on the internet can POST /auth/v1/signup, get a confirmed
-- session instantly, and then read every table (all the policies were `USING (true)`).
-- Verified by actually signing up through the public endpoint before writing this.
--
-- Fix: every policy now requires the caller to be a KNOWN, ACTIVE staff member — a row in
-- public.users with is_active = true, which is the same flag the app's waiting-approval screen
-- uses. A self-registered stranger has no such row (or an inactive one) and sees nothing.

-- SECURITY DEFINER on purpose: the helper reads public.users, and a policy ON users that queried
-- users directly would recurse. Definer rights bypass RLS inside the function only.
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.is_active IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_staff() FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;

-- Re-create every read policy behind the gate.
DROP POLICY IF EXISTS "auth read products"              ON products;
DROP POLICY IF EXISTS "auth read purchase_orders"       ON purchase_orders;
DROP POLICY IF EXISTS "auth read stock_transactions"    ON stock_transactions;
DROP POLICY IF EXISTS "auth read restaurant_config"     ON restaurant_config;
DROP POLICY IF EXISTS "Allow read for all authenticated users" ON sales_orders;
DROP POLICY IF EXISTS "Allow read finance snapshots for authenticated" ON finance_daily_snapshots;
DROP POLICY IF EXISTS "Allow read olsera mappings for authenticated"   ON olsera_product_mappings;
DROP POLICY IF EXISTS "Allow read olsera runs for authenticated"       ON olsera_sync_runs;
DROP POLICY IF EXISTS "Allow read users for authenticated"             ON users;
DROP POLICY IF EXISTS "Users can update own profile"                   ON users;

CREATE POLICY "staff read products"           ON products              FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read purchase_orders"    ON purchase_orders       FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read stock_transactions" ON stock_transactions    FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read restaurant_config"  ON restaurant_config     FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read sales_orders"       ON sales_orders          FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read finance_snapshots"  ON finance_daily_snapshots FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read olsera_mappings"    ON olsera_product_mappings FOR SELECT TO authenticated USING (public.is_active_staff());
CREATE POLICY "staff read olsera_runs"        ON olsera_sync_runs      FOR SELECT TO authenticated USING (public.is_active_staff());

-- users: a signed-in person may always read their OWN row (the app needs it to decide whether to
-- show the waiting-approval screen); reading the rest of the staff list requires being active.
CREATE POLICY "staff read users" ON users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_active_staff());
CREATE POLICY "user update own profile" ON users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- RLS policies are PERMISSIVE (OR-ed): one leftover `USING (true)` re-opens the table no matter how
-- strict the gated policy is. Drop-by-name kept missing because the originals carry unpredictable
-- names, so sweep by DEFINITION instead — anything still ungated goes.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND coalesce(qual, 'true') NOT LIKE '%is_active_staff%'
      AND coalesce(qual, '')     NOT LIKE '%auth.uid()%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
    RAISE NOTICE 'swept ungated policy % on %', p.policyname, p.tablename;
  END LOOP;
END $$;
