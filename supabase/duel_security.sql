-- ============================================================================
-- Qubit — Duel anti-cheat (RECOMMENDED, run after duel_upgrades.sql).
--
-- Today any signed-in player can talk to Supabase directly from the browser
-- console and (a) READ the duel's answer key from quiz_matches.questions and
-- (b) UPDATE their own host_score / guest_score. The app itself never does
-- either — every read and write goes through /api/quiz/* with the service-role
-- key, which bypasses these rules. So locking them down changes nothing for
-- honest players and closes the cheating hole.
--
-- Safe to run more than once. To undo, re-create the two policies from
-- supabase/quiz_qpoints.sql and run:
--   grant select on public.quiz_matches to authenticated;
-- ============================================================================

-- Make sure the columns granted below exist (no-op if duel_upgrades.sql ran).
alter table public.quiz_matches add column if not exists host_seen_at timestamptz;
alter table public.quiz_matches add column if not exists guest_seen_at timestamptz;
alter table public.quiz_matches add column if not exists host_picks jsonb not null default '[]'::jsonb;
alter table public.quiz_matches add column if not exists guest_picks jsonb not null default '[]'::jsonb;

-- 1. Players can no longer write matches from the browser.
drop policy if exists quiz_matches_update_participant on public.quiz_matches;
drop policy if exists quiz_matches_insert_host on public.quiz_matches;

-- 2. The browser can still read match progress (lobby "resume game", admin
--    list) — but never the question set, which contains the correct answers.
revoke select on public.quiz_matches from anon, authenticated;
grant select (
  id, host_id, guest_id, subject, question_count, status,
  host_index, guest_index, host_score, guest_score, host_finished, guest_finished,
  current_turn, turn_ends_at, winner_id, points_awarded, created_at, completed_at,
  host_seen_at, guest_seen_at, host_picks, guest_picks
) on public.quiz_matches to authenticated;
