-- ============================================================================
-- Qubit — Duel upgrades. Run ONCE in the Supabase SQL editor (idempotent —
-- safe to run again).
--
--  • Open duels: regular quiz_matches rows with status 'waiting' and
--    guest_id = null; anyone with the share link claims the seat through
--    POST /api/quiz/match/join.
--  • Presence: host_seen_at / guest_seen_at are refreshed by the match-state
--    poll while a player is on the game screen. If a player leaves, their
--    timestamp goes stale and the opponent can claim the win after a 30s
--    grace period (POST action:"claim-win").
--  • Head-to-head rounds: both players answer the SAME question at the same
--    time (25 seconds). host_picks / guest_picks record what each player
--    chose per question (-1 = ran out of time) so the reveal between
--    questions and the post-game review can show both answers. The duel still
--    runs without them — you just lose the per-question detail.
--  • question_count is locked to 10 per match.
-- ============================================================================

alter table public.quiz_matches add column if not exists host_seen_at timestamptz;
alter table public.quiz_matches add column if not exists guest_seen_at timestamptz;

alter table public.quiz_matches add column if not exists host_picks jsonb not null default '[]'::jsonb;
alter table public.quiz_matches add column if not exists guest_picks jsonb not null default '[]'::jsonb;

-- Lock question count to exactly 10 for NEW matches. NOT VALID skips the check on
-- rows that already exist (old test games may have fewer questions) but still
-- enforces it on every insert/update.
alter table public.quiz_matches drop constraint if exists quiz_matches_question_count_check;
alter table public.quiz_matches add constraint quiz_matches_question_count_check check (question_count = 10) not valid;

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
