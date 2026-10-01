-- ============================================================================
-- Qubit — Online status (Facebook-style green dots)
-- Run ONCE in the Supabase SQL editor (idempotent).
--
-- Every signed-in client heartbeats profiles.last_seen_at every 60s while
-- the app is open. "Online" = heartbeat within the last 3 minutes. The dot
-- itself is rendered client-side; no extra tables or realtime needed.
-- ============================================================================

alter table public.profiles add column if not exists last_seen_at timestamptz;
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at);

-- Done. Green dots appear on community posts, DMs, profiles and the
-- leaderboard once students open the app again (first heartbeat).