-- ============================================================================
-- Qubit — Quiz game (Qubit Arena): QPoints ledger, matches, invites,
-- admin settings + weekly leaderboard. Run ONCE in Supabase SQL editor
-- (idempotent).
--
-- Design notes:
--  • QPoints are NEVER written by the browser. Scoring happens in
--    /api/quiz/* routes using the service-role key, so the ledger can't be
--    faked from the client. RLS only exposes reads.
--  • quiz_matches.questions holds the server-generated question set
--    INCLUDING correct answers (jsonb) — the client gets redacted copies
--    from the API, and the API validates every submitted answer.
-- ============================================================================

-- ── 1. QPoints ledger (append-only) ─────────────────────────────────────────
create table if not exists public.qpoints_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in
    ('duel_win','duel_participation','solo_game','achievement','daily_challenge','admin_adjust')),
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists qpoints_ledger_user_idx on public.qpoints_ledger (user_id, created_at desc);

-- ── 2. Quiz matches ──────────────────────────────────────────────────────────
create table if not exists public.quiz_matches (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid references public.profiles(id) on delete cascade, -- null = solo
  subject text not null,
  question_count integer not null default 10 check (question_count = 10),
  status text not null default 'waiting'
    check (status in ('waiting','active','completed','declined','expired')),
  -- Server-side question set (with answers) + per-player progress
  questions jsonb not null default '[]'::jsonb,
  host_index integer not null default 0,
  guest_index integer not null default 0,
  host_score integer not null default 0,
  guest_score integer not null default 0,
  host_finished boolean not null default false,
  guest_finished boolean not null default false,
  current_turn text check (current_turn in ('host','guest')),
  turn_ends_at timestamptz,
  winner_id uuid references public.profiles(id) on delete set null,
  points_awarded boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists quiz_matches_host_idx on public.quiz_matches (host_id);
create index if not exists quiz_matches_guest_idx on public.quiz_matches (guest_id);

-- ── 3. Invites (friend → duel) ───────────────────────────────────────────────
create table if not exists public.quiz_invites (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.quiz_matches(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  -- Copied from the match so the recipient can see the subject without
  -- needing read access to the (still waiting) match row.
  subject text,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists quiz_invites_to_idx on public.quiz_invites (to_id, status);

-- ── 4. Admin settings (leaderboard reset day, current period start) ─────────
create table if not exists public.admin_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.admin_settings (key, value) values
  ('leaderboard_reset_day', 'sunday'),
  ('leaderboard_period_start', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
on conflict (key) do nothing;

-- ── 5. Leaderboard history (snapshot taken at each weekly reset) ────────────
create table if not exists public.leaderboard_history (
  id uuid primary key default gen_random_uuid(),
  period text not null,               -- e.g. '2026-W40'
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  rank integer not null,
  created_at timestamptz not null default now()
);
create index if not exists leaderboard_history_period_idx on public.leaderboard_history (period);

-- ── 6. RLS ───────────────────────────────────────────────────────────────────
alter table public.qpoints_ledger      enable row level security;
alter table public.quiz_matches        enable row level security;
alter table public.quiz_invites        enable row level security;
alter table public.admin_settings      enable row level security;
alter table public.leaderboard_history enable row level security;

do $$
begin
  -- Ledger: read your own rows; admins read all. No insert policy on purpose —
  -- only the API routes (service role) may award points.
  if not exists (select 1 from pg_policies where tablename = 'qpoints_ledger' and policyname = 'qpoints_select_own') then
    create policy qpoints_select_own on public.qpoints_ledger
      for select using (
        user_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;

  -- Matches: participants read + update (their own progress columns);
  -- the host creates. Admins everything.
  if not exists (select 1 from pg_policies where tablename = 'quiz_matches' and policyname = 'quiz_matches_select_participant') then
    create policy quiz_matches_select_participant on public.quiz_matches
      for select using (
        host_id = auth.uid() or guest_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_matches' and policyname = 'quiz_matches_insert_host') then
    create policy quiz_matches_insert_host on public.quiz_matches
      for insert with check (host_id = auth.uid() or guest_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_matches' and policyname = 'quiz_matches_update_participant') then
    create policy quiz_matches_update_participant on public.quiz_matches
      for update using (
        host_id = auth.uid() or guest_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;

  -- Invites: sender + recipient manage them.
  if not exists (select 1 from pg_policies where tablename = 'quiz_invites' and policyname = 'quiz_invites_select_party') then
    create policy quiz_invites_select_party on public.quiz_invites
      for select using (from_id = auth.uid() or to_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_invites' and policyname = 'quiz_invites_insert_from') then
    create policy quiz_invites_insert_from on public.quiz_invites
      for insert with check (from_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'quiz_invites' and policyname = 'quiz_invites_update_party') then
    create policy quiz_invites_update_party on public.quiz_invites
      for update using (from_id = auth.uid() or to_id = auth.uid());
  end if;

  -- Admin settings: admins only.
  if not exists (select 1 from pg_policies where tablename = 'admin_settings' and policyname = 'admin_settings_select_admin') then
    create policy admin_settings_select_admin on public.admin_settings
      for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'admin_settings' and policyname = 'admin_settings_write_admin') then
    create policy admin_settings_write_admin on public.admin_settings
      for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;

  -- Leaderboard history: public read, service-role writes.
  if not exists (select 1 from pg_policies where tablename = 'leaderboard_history' and policyname = 'leaderboard_history_select_all') then
    create policy leaderboard_history_select_all on public.leaderboard_history for select using (true);
  end if;
end $$;

-- ── 7. Server-side RPCs ──────────────────────────────────────────────────────

-- Weekly leaderboard: aggregates the ledger since a timestamp. SECURITY
-- DEFINER so clients can see everyone's points without exposing ledger rows.
create or replace function public.weekly_leaderboard(p_since timestamptz)
returns table (user_id uuid, full_name text, user_code text, avatar_url text, points bigint)
language sql security definer set search_path = public stable as $$
  select l.user_id, p.full_name, p.user_code, p.avatar_url,
         sum(l.delta)::bigint
  from public.qpoints_ledger l
  join public.profiles p on p.id = l.user_id
  where l.created_at >= p_since
  group by l.user_id, p.full_name, p.user_code, p.avatar_url
  having sum(l.delta) > 0
  order by sum(l.delta) desc
  limit 100;
$$;
grant execute on function public.weekly_leaderboard(timestamptz) to authenticated;

-- All-time points for a profile page.
create or replace function public.my_total_points(p_user uuid)
returns integer
language sql security definer set search_path = public stable as $$
  select coalesce(sum(delta), 0)::integer from public.qpoints_ledger where user_id = p_user;
$$;
grant execute on function public.my_total_points(uuid) to authenticated;

-- Done. Verify: /arena creates matches, /leaderboard lists the week's top.