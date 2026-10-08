-- Security hardening + "report a wrong question". Run once in Supabase → SQL Editor. Safe to re-run.

-- ── 1. A student must never be able to edit their own role, Pro plan, trial or user code ─────────────────────────
-- (Before this, the "profiles are editable by owner" rule let any signed-in student write role='admin' or a far-future
--  premium_until straight from the browser.) Only admins, the server (service role) and database functions may change them.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not coalesce(public.is_admin(), false)
     and (   new.id             is distinct from old.id
          or new.role           is distinct from old.role
          or new.premium_until  is distinct from old.premium_until
          or new.trial_used_at  is distinct from old.trial_used_at
          or new.user_code      is distinct from old.user_code
          or new.created_at     is distinct from old.created_at)
  then
    raise exception 'You are not allowed to change that field.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ── 2. Signed-out visitors don't need to call these helper functions ────────────────────────────────────────────
revoke execute on function public.is_pro(uuid)                          from public, anon;
revoke execute on function public.my_premium_status(uuid)               from public, anon;
revoke execute on function public.my_total_points(uuid)                 from public, anon;
revoke execute on function public.public_profile_stats(uuid)            from public, anon;
revoke execute on function public.public_social_stats(uuid)             from public, anon;
revoke execute on function public.suggested_people()                    from public, anon;
revoke execute on function public.weekly_leaderboard(timestamptz)       from public, anon;

-- ── 3. Wrong-question reports (students flag a question; admins hide it or dismiss the report) ───────────────────
create table if not exists public.question_reports (
  id          uuid primary key default gen_random_uuid(),
  bank_key    text not null,                 -- same key as question_bank.key (subject + hash of text and options)
  subject     text not null,
  question_id text,
  prompt      text not null,                 -- first part of the question, so admins can read it
  options     jsonb,
  reason      text not null check (reason in ('wrong_answer','typo','bad_image','unclear','other')),
  note        text,
  user_id     uuid references public.profiles(id) on delete set null,
  status      text not null default 'open' check (status in ('open','hidden','dismissed')),
  created_at  timestamptz not null default now(),
  unique (bank_key, user_id)
);
create index if not exists idx_question_reports_status on public.question_reports (status, created_at desc);
create index if not exists idx_question_reports_key on public.question_reports (bank_key);

alter table public.question_reports enable row level security;
drop policy if exists "admins read question reports" on public.question_reports;
create policy "admins read question reports" on public.question_reports
  for select to authenticated using (public.is_admin());
drop policy if exists "admins update question reports" on public.question_reports;
create policy "admins update question reports" on public.question_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Students submit reports through /api/questions/report (service role), so there is no insert policy.
