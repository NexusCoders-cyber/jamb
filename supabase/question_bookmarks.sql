-- Question bookmarks — cloud copy of the bookmarks students keep on their device.
-- The app is offline-first: bookmarks are saved on the phone and only pushed here when the student
-- taps "Back up now" (or signs in). Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.question_bookmarks (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  question_id   text not null,               -- ALOC / bundled question id (string, not a uuid)
  subject       text,
  question_data jsonb not null,              -- full question snapshot so it renders without a join
  created_at    timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index if not exists question_bookmarks_user_created_idx
  on public.question_bookmarks (user_id, created_at desc);

alter table public.question_bookmarks enable row level security;

drop policy if exists "users manage own bookmarks" on public.question_bookmarks;
create policy "users manage own bookmarks" on public.question_bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
