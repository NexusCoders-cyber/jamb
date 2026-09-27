-- ─── Fix: profile visibility, attempt answer snapshots, backfill ─────────────
-- Run this in the Supabase SQL editor. Fully idempotent — safe to re-run.
--
-- Fixes three production issues:
--   1. Profiles of OTHER users were unreadable (RLS = owner-only), which broke
--      DM search, partner names, and community author names.
--   2. attempt_answers.question_id holds ALOC string IDs with no join to the
--      questions table, so review/mistakes/analytics queries with an embedded
--      join to questions failed and returned empty lists.
--   3. Users created before the profile trigger existed had no profile row,
--      which blocked exam attempt creation (FK violation).

-- ── 1. Profiles: everyone can see names, owners manage their own row ─────────
drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles are editable by owner" on public.profiles;
create policy "profiles are editable by owner"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

-- ── 2. attempt_answers: store a snapshot of the question for review ──────────
-- question_id stays a plain ALOC string id (no FK). question_data holds the
-- normalized question (prompt/options/answer/explanation) at answer time.
alter table public.attempt_answers
  add column if not exists question_data jsonb;

-- ── 3. Profile trigger + backfill for pre-existing users ─────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', '') as full_name,
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
