-- Question bank: every question the ALOC API returns is saved here (server-side, by /api/aloc), so the app
-- builds its own copy of the questions and can keep serving students when ALOC is slow, down or out of credits.
-- Run once in Supabase → SQL Editor. Safe to re-run. Until it is run the app keeps working exactly as before.

create table if not exists public.question_bank (
  key         text primary key,                 -- "<subject>:<hash of question text + options>" (de-duplicates reused questions)
  subject     text not null,                    -- lower-case subject name, e.g. "mathematics"
  year        text,
  exam_type   text,
  has_images  boolean not null default false,
  data        jsonb not null,                   -- the full question exactly as the app serves it
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_question_bank_subject_year on public.question_bank (subject, year);

alter table public.question_bank enable row level security;
-- Students never read this table directly (the API does, with the service role). Admins can look at it.
drop policy if exists "admins read question bank" on public.question_bank;
create policy "admins read question bank" on public.question_bank
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- A random sample for one subject (and optionally one exam year).
create or replace function public.question_bank_sample(p_subject text, p_year text, p_count int)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select data from public.question_bank
  where subject = lower(trim(p_subject)) and (p_year is null or year = p_year)
  order by random()
  limit greatest(least(coalesce(p_count, 40), 400), 1)
$$;

-- Totals for the admin dashboard.
create or replace function public.question_bank_stats()
returns table (subject text, total bigint, with_images bigint)
language sql stable security definer set search_path = public as $$
  select subject, count(*), count(*) filter (where has_images) from public.question_bank group by subject order by 2 desc
$$;

revoke execute on function public.question_bank_sample(text, text, int) from public, anon, authenticated;
revoke execute on function public.question_bank_stats() from public, anon, authenticated;
grant execute on function public.question_bank_sample(text, text, int) to service_role;
grant execute on function public.question_bank_stats() to service_role;
