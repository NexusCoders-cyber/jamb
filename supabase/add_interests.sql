-- ─── Profile interests (for the Students / friends browser) ──────────────────
-- Run in the Supabase SQL editor. Idempotent.

alter table public.profiles
  add column if not exists interests text[] not null default '{}';

alter table public.profiles
  add column if not exists course text not null default '';
