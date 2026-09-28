-- ─── Profile: avatar image + bio ─────────────────────────────────────────────
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Fixes applied:
--   * Bucket creation now FORCES public = true on conflict. Previously
--     `on conflict do nothing` silently kept a pre-existing private bucket,
--     which made every avatar 404 on public read.
--   * Adds a 5 MB file-size limit so users can't upload huge images.
--   * Policies are drop-then-create so re-runs never error on duplicates.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists avatar_url text not null default '';

alter table public.profiles
  add column if not exists bio text not null default '';

-- ── 2. Storage bucket (public read, 5 MB limit) ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880;

-- ── 3. Policies ──────────────────────────────────────────────────────────────
-- Anyone (even signed-out) can view avatars — the bucket is public.
drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Signed-in users manage objects inside their own folder (named by uid).
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 4. Verify (optional) — run these to confirm the state: ──────────────────
--   select id, public, file_size_limit from storage.buckets where id = 'avatars';
--   select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';
