-- ============================================================================
-- Qubit — Premium payments: Paystack checkout support, discount codes,
-- premium status on profiles. Run ONCE in Supabase SQL editor (idempotent).
--
-- Model: TWO plans, prices live in admin_settings (admin-editable):
--   • lifetime  — pay once, premium forever
--   • monthly   — premium for 30 days at a time
-- Premium currently unlocks a badge only (gating comes later from admin).
-- ============================================================================

-- ── 1. Premium status on profiles ───────────────────────────────────────────
alter table public.profiles add column if not exists premium_lifetime boolean not null default false;
alter table public.profiles add column if not exists premium_until timestamptz;

-- ── 2. Discount codes (admin-managed) ───────────────────────────────────────
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- uppercase, e.g. JAMB2026
  kind text not null check (kind in ('percent','fixed')),
  value integer not null check (value > 0),  -- percent (1-100) or kobo amount
  max_uses integer,                           -- null = unlimited
  used_count integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Who used which code (anti-abuse + reporting)
create table if not exists public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.discount_codes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  amount_off_kobo integer not null default 0,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)                  -- one redemption per student per code
);

-- ── 3. Payments table additions (plan + discount trail) ─────────────────────
alter table public.payments add column if not exists plan text;         -- 'lifetime' | 'monthly'
alter table public.payments add column if not exists discount_code text;

-- ── 4. Default prices in admin_settings ─────────────────────────────────────
insert into public.admin_settings (key, value) values
  ('price_lifetime_naira', '1000'),
  ('price_monthly_naira', '500')
on conflict (key) do nothing;

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
alter table public.discount_codes       enable row level security;
alter table public.discount_redemptions enable row level security;

do $$
begin
  -- Codes: admins manage; students never read them directly (checkout API
  -- validates server-side, so codes can't be probed from the browser).
  if not exists (select 1 from pg_policies where tablename = 'discount_codes' and policyname = 'discount_codes_admin_all') then
    create policy discount_codes_admin_all on public.discount_codes
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;

  -- Redemptions: admins read; service-role writes (checkout API).
  if not exists (select 1 from pg_policies where tablename = 'discount_redemptions' and policyname = 'discount_redemptions_admin_read') then
    create policy discount_redemptions_admin_read on public.discount_redemptions
      for select using (
        user_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end $$;

-- Done. Admin sets prices + creates codes at /admin/payments.