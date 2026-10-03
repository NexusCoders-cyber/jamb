-- ============================================================================
-- Orbit Prep — Free trial system (run ONCE, idempotent)
-- Admin controls: free_trial_enabled (true/false), free_trial_days (integer)
-- Per-user:       trial_used_at (timestamptz) — null = never claimed
-- ============================================================================

-- Track when a user used their trial (null = never used)
alter table public.profiles add column if not exists trial_used_at timestamptz;

-- Ensure admin_settings has the trial control keys
insert into public.admin_settings (key, value) values
  ('free_trial_enabled', 'false'),
  ('free_trial_days',    '1')
on conflict (key) do nothing;
