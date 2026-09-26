-- ─── Safe re-runnable schema ─────────────────────────────────────────────────
-- Run this instead of schema.sql when the database already has some objects.
-- Every statement is idempotent — safe to run multiple times.

create extension if not exists "pgcrypto";

-- ── Enum types (only create if they don't exist) ──────────────────────────────
do $$ begin
  create type public.user_role as enum ('student', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'success', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.user_role not null default 'student',
  target_score integer not null default 300 check (target_score between 0 and 400),
  streak_days integer not null default 0 check (streak_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array'),
  correct_option integer not null check (correct_option >= 0),
  explanation text,
  difficulty text not null default 'medium',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  question_count integer not null check (question_count > 0),
  status public.attempt_status not null default 'in_progress',
  score integer not null default 0 check (score >= 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id text not null,  -- ALOC question ID (string, not a UUID); no FK to questions table
  selected_option integer,
  is_correct boolean,
  marked_for_review boolean not null default false,
  answered_at timestamptz,
  unique (attempt_id, question_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference text not null unique,
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.subjects        enable row level security;
alter table public.questions       enable row level security;
alter table public.exam_attempts   enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.payments        enable row level security;
alter table public.notifications   enable row level security;

-- Drop and recreate policies so re-runs don't error on duplicates
do $$ begin

  -- profiles
  drop policy if exists "profiles are readable by owner" on public.profiles;
  drop policy if exists "profiles are editable by owner" on public.profiles;
  create policy "profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
  create policy "profiles are editable by owner" on public.profiles for update using (auth.uid() = id);

  -- subjects
  drop policy if exists "published subjects are public" on public.subjects;
  create policy "published subjects are public" on public.subjects for select using (true);

  -- questions
  drop policy if exists "published questions are public" on public.questions;
  create policy "published questions are public" on public.questions for select using (is_published = true);

  -- exam_attempts
  drop policy if exists "users manage own attempts" on public.exam_attempts;
  create policy "users manage own attempts" on public.exam_attempts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

  -- attempt_answers
  drop policy if exists "users manage own answers" on public.attempt_answers;
  create policy "users manage own answers" on public.attempt_answers
    for all
    using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()))
    with check (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

  -- payments
  drop policy if exists "users read own payments" on public.payments;
  create policy "users read own payments" on public.payments for select using (auth.uid() = user_id);

  -- notifications
  drop policy if exists "users read own notifications" on public.notifications;
  drop policy if exists "users update own notifications" on public.notifications;
  create policy "users read own notifications" on public.notifications for select using (auth.uid() = user_id);
  create policy "users update own notifications" on public.notifications for update using (auth.uid() = user_id);

end $$;

-- ── Trigger: auto-create profile on signup ────────────────────────────────────

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
  on conflict (id) do nothing;  -- safe if profile already exists
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Core query patterns: filter attempts by user, answers by attempt, notifications by user.
create index if not exists idx_exam_attempts_user_id      on public.exam_attempts(user_id);
create index if not exists idx_exam_attempts_status       on public.exam_attempts(status);
create index if not exists idx_attempt_answers_attempt_id on public.attempt_answers(attempt_id);
create index if not exists idx_notifications_user_id      on public.notifications(user_id);
create index if not exists idx_payments_user_id           on public.payments(user_id);

-- ── Backfill: create profiles for any existing auth users that don't have one ──
insert into public.profiles (id, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', '') as full_name,
  u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
