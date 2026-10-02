-- ============================================================================
-- Orbit Prep — Subscription system
-- Plans: weekly (7 days), monthly (30 days), biannual (180 days)
-- Prices and Paystack keys are admin-editable in admin_settings.
-- Run ONCE in the Supabase SQL editor (idempotent).
-- ============================================================================

-- ── 1. Premium status on profiles ───────────────────────────────────────────
-- premium_until = null  → free user
-- premium_until > now() → active Pro
alter table public.profiles add column if not exists premium_until timestamptz;

-- Drop old lifetime column if it exists from premium_payments.sql
alter table public.profiles drop column if exists premium_lifetime;

-- ── 2. Plan prices + Paystack keys in admin_settings ────────────────────────
-- Keys stored in DB so admin can update without redeploying.
-- IMPORTANT: store the LIVE secret key here — the API reads it server-side
-- and never exposes it to the browser.
insert into public.admin_settings (key, value) values
  ('price_weekly_naira',    '200'),
  ('price_monthly_naira',   '800'),
  ('price_biannual_naira',  '1700'),
  ('paystack_secret_key',   ''),          -- admin fills this in the portal
  ('paystack_public_key',   '')           -- shown to browser for inline popup
on conflict (key) do nothing;

-- ── 3. Update existing plan prices if they were set by premium_payments.sql ──
update public.admin_settings set value = '800'  where key = 'price_monthly_naira'  and value = '500';
update public.admin_settings set value = '200'  where key = 'price_weekly_naira'   and value != '200';
update public.admin_settings set value = '1700' where key = 'price_biannual_naira' and value != '1700';

-- Remove old lifetime price key (replaced by biannual)
delete from public.admin_settings where key = 'price_lifetime_naira';

-- ── 4. Payments table — add plan values for new plans ───────────────────────
-- plan column already exists from premium_payments.sql, just update the check
alter table public.payments drop constraint if exists payments_plan_check;
-- No constraint needed — plan is a free text field

-- ── 5. is_pro() — fast server-side check usable in RLS and RPCs ──────────────
create or replace function public.is_pro(p_user uuid)
returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = p_user
      and premium_until is not null
      and premium_until > now()
  );
$$;
grant execute on function public.is_pro(uuid) to authenticated;

-- ── 6. RPC for client: returns the user's premium status + expiry ────────────
create or replace function public.my_premium_status(p_user uuid)
returns table (is_pro boolean, premium_until timestamptz, plan text)
language sql security definer set search_path = public stable as $$
  select
    (premium_until is not null and premium_until > now()) as is_pro,
    premium_until,
    null::text as plan  -- plan is on the payments table, resolved client-side
  from public.profiles
  where id = p_user;
$$;
grant execute on function public.my_premium_status(uuid) to authenticated;

-- ── 7. Realtime: let profile updates (premium_until) push to the client ──────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
