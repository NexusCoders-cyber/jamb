-- ============================================================================
-- Qubit — Achievements: definitions, unlocks, PNG icon storage, RLS.
-- Run ONCE in the Supabase SQL editor (idempotent).
--
-- Achievement icons are PNGs uploaded by admins to the public `achievements`
-- storage bucket (mime + extension validated client-side before upload).
-- Unlocks + QPoints bonuses are written by /api/achievements/evaluate with
-- the service-role key — clients can't fake achievements.
-- ============================================================================

-- ── 1. Achievement definitions (admin-managed) ──────────────────────────────
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- stable id used by the evaluator
  name text not null,
  description text not null default '',
  points integer not null default 10,      -- achievement points (→ QPoints bonus)
  icon_url text,                            -- public URL of the PNG (achievements bucket)
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── 2. Unlocks (one row per user per achievement) ───────────────────────────
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);
create index if not exists user_achievements_user_idx on public.user_achievements (user_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table public.achievements       enable row level security;
alter table public.user_achievements  enable row level security;

do $$
begin
  -- Definitions: everyone reads active ones; admins manage.
  if not exists (select 1 from pg_policies where tablename = 'achievements' and policyname = 'achievements_select_all') then
    create policy achievements_select_all on public.achievements for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'achievements' and policyname = 'achievements_admin_write') then
    create policy achievements_admin_write on public.achievements
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;

  -- Unlocks: public read (profile pages show them), service-role writes only.
  if not exists (select 1 from pg_policies where tablename = 'user_achievements' and policyname = 'user_achievements_select_all') then
    create policy user_achievements_select_all on public.user_achievements for select using (true);
  end if;
end $$;

-- ── 4. Public storage bucket for achievement PNGs ────────────────────────────
insert into storage.buckets (id, name, public)
values ('achievements', 'achievements', true)
on conflict (id) do nothing;

-- Public read of achievement icons
drop policy if exists "achievements icons public read" on storage.objects;
create policy "achievements icons public read" on storage.objects
  for select using (bucket_id = 'achievements');

-- Only admins may upload/replace/delete icons
drop policy if exists "achievements icons admin write" on storage.objects;
create policy "achievements icons admin write" on storage.objects
  for insert with check (
    bucket_id = 'achievements'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "achievements icons admin update" on storage.objects;
create policy "achievements icons admin update" on storage.objects
  for update using (
    bucket_id = 'achievements'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
drop policy if exists "achievements icons admin delete" on storage.objects;
create policy "achievements icons admin delete" on storage.objects
  for delete using (
    bucket_id = 'achievements'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 5. Seed the starter achievement set (matches the evaluator rules) ───────
insert into public.achievements (code, name, description, points, position) values
  ('first_exam',     'First Step',        'Complete your first exam',        10, 1),
  ('streak_3',       '3-Day Starter',     'Reach a 3-day streak',            10, 2),
  ('streak_7',       'One Week Warrior',  'Reach a 7-day streak',            25, 3),
  ('streak_14',      'Two-Week Champion', 'Reach a 14-day streak',           50, 4),
  ('streak_30',      '30-Day Scholar',    'Reach a 30-day streak',          100, 5),
  ('streak_100',     '100-Day Scholar',   'Reach a 100-day streak',         250, 6),
  ('questions_100',  'Century Club',      'Answer 100 questions',            25, 7),
  ('questions_500',  'Question Master',   'Answer 500 questions',            75, 8),
  ('exams_5',        'Prolific',          'Complete 5 exams',                25, 9),
  ('exams_10',       'Exam Ready',        'Complete 10 exams',               50, 10),
  ('duel_win_1',     'First Blood',       'Win your first Arena duel',       25, 11),
  ('duel_win_5',     'Duelist',           'Win 5 Arena duels',               75, 12),
  ('points_500',     'Point Hoarder',     'Earn 500 QPoints in total',      100, 13)
on conflict (code) do nothing;

-- Done. Admins manage icons at /admin/achievements (PNG uploads).
