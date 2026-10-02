-- ============================================================================
-- Qubit — Duel upgrades: open duels (share link) + abandonment detection.
-- Run ONCE in the Supabase SQL editor (idempotent).
--
--  • Open duels are regular quiz_matches rows with status 'waiting' and
--    guest_id = null; anyone with the share link can claim the seat via
--    POST /api/quiz/match/join.
--  • host_seen_at / guest_seen_at are refreshed by the match-state GET poll
--    (every ~3s while a player is on the match screen). If a player leaves
--    the game screen, their timestamp goes stale and the opponent can claim
--    the win after a 25s grace period (POST action:"claim-win").
--  • question_count is locked to 10 per match — each player answers all 10
--    questions on alternating turns (turn_ends_at resets per turn).
-- ============================================================================

alter table public.quiz_matches add column if not exists host_seen_at timestamptz;
alter table public.quiz_matches add column if not exists guest_seen_at timestamptz;

-- Lock question count to exactly 10 (applies to new rows; existing rows unchanged).
-- Drop any old lax constraint first, then add the strict one.
alter table public.quiz_matches drop constraint if exists quiz_matches_question_count_check;
alter table public.quiz_matches add constraint quiz_matches_question_count_check check (question_count = 10);

create index if not exists quiz_matches_status_idx on public.quiz_matches (status);

-- ----------------------------------------------------------------------------
-- Live duel invites: put quiz_invites on the realtime publication so invite
-- arrivals and badges update instantly. Without this, clients fall back to
-- polling. (Idempotent — safe to run on databases where it's already added.)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_invites'
  ) then
    alter publication supabase_realtime add table public.quiz_invites;
  end if;
end $$;
