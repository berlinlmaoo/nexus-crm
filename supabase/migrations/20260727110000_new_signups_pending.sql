-- Root cause of the leak the gated policies still couldn't stop: self-signup produced an ACTIVE
-- staff member. `public.users.is_active` defaulted to true AND the on_auth_user_created trigger
-- hard-coded `true`, so anyone who hit /auth/v1/signup instantly satisfied is_active_staff() and
-- could read products, users, sales_orders, stock_transactions and purchase_orders.
-- Verified end-to-end against the public endpoint before and after this change.
--
-- New accounts now land INACTIVE, which is also what the app already expects — it ships a
-- waiting-approval screen that had nothing to gate on. An admin flips is_active to grant access.

ALTER TABLE public.users ALTER COLUMN is_active SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    NEW.raw_user_meta_data->>'role',
    false                     -- pending approval, never auto-active
  )
  ON CONFLICT (id) DO UPDATE SET
    name  = COALESCE(EXCLUDED.name, public.users.name),
    email = EXCLUDED.email,
    role  = COALESCE(public.users.role, EXCLUDED.role),
    -- keep whatever an admin already decided; a re-signup must not re-activate anyone
    is_active = COALESCE(public.users.is_active, false);

  RETURN NEW;
END;
$$;

-- The 6 existing staff stay active — this only changes who is active GOING FORWARD.
