-- ─── Syllabus · Promos · DM replies/delete · Announcements ───────────────────
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- 1. syllabus_items   — per-subject syllabus content (admin-managed)
-- 2. syllabus bucket  — file uploads (PDFs/images/docs) shown as attachments
-- 3. promos           — dashboard promo banners (image + write-up)
-- 4. promo bucket     — banner images
-- 5. direct_messages  — reply_to_id column + sender-delete policy
-- 6. notifications    — re-assert admin broadcast insert policy
--
-- After running, make sure at least one admin exists:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

-- ── 1. Syllabus ───────────────────────────────────────────────────────────────
create table if not exists public.syllabus_items (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,                      -- subject NAME as used across the app, e.g. 'Use of English'
  title       text not null,                      -- e.g. 'Topic 1: Nuclear physics' or full syllabus doc
  body        text not null default '',           -- markdown/plain text content
  file_url    text,                               -- optional attachment in the syllabus bucket
  file_name   text,
  position    integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_syllabus_subject on public.syllabus_items (subject, position, created_at);
alter table public.syllabus_items enable row level security;

do $$ begin
  drop policy if exists "syllabus readable by all" on public.syllabus_items;
  create policy "syllabus readable by all"
    on public.syllabus_items for select using (true);

  drop policy if exists "admins manage syllabus" on public.syllabus_items;
  create policy "admins manage syllabus"
    on public.syllabus_items for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
end $$;

-- ── 2. syllabus storage bucket (public read, admin write) ────────────────────
insert into storage.buckets (id, name, public)
values ('syllabus', 'syllabus', true)
on conflict (id) do update set public = true;

do $$ begin
  drop policy if exists "syllabus files public read" on storage.objects;
  create policy "syllabus files public read"
    on storage.objects for select using (bucket_id = 'syllabus');

  drop policy if exists "syllabus files admin write" on storage.objects;
  create policy "syllabus files admin write"
    on storage.objects for all to authenticated
    using (bucket_id = 'syllabus' and public.is_admin())
    with check (bucket_id = 'syllabus' and public.is_admin());
end $$;

-- ── 3. Promos (dashboard banner) ──────────────────────────────────────────────
create table if not exists public.promos (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  image_url  text,
  cta_label  text,
  cta_href   text,
  is_active  boolean not null default true,
  position   integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_promos_active on public.promos (is_active, position, created_at desc);
alter table public.promos enable row level security;

do $$ begin
  drop policy if exists "active promos readable by all" on public.promos;
  create policy "active promos readable by all"
    on public.promos for select using (true);

  drop policy if exists "admins manage promos" on public.promos;
  create policy "admins manage promos"
    on public.promos for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
end $$;

-- ── 4. promo storage bucket (public read, admin write) ───────────────────────
insert into storage.buckets (id, name, public)
values ('promos', 'promos', true)
on conflict (id) do update set public = true;

do $$ begin
  drop policy if exists "promo files public read" on storage.objects;
  create policy "promo files public read"
    on storage.objects for select using (bucket_id = 'promos');

  drop policy if exists "promo files admin write" on storage.objects;
  create policy "promo files admin write"
    on storage.objects for all to authenticated
    using (bucket_id = 'promos' and public.is_admin())
    with check (bucket_id = 'promos' and public.is_admin());
end $$;

-- ── 5. DM replies + delete ────────────────────────────────────────────────────
-- WhatsApp-style: adding a reply reference and letting senders delete their
-- own messages. Recipients keep read access (needed to render the thread);
-- deleting only clears content, keeping thread ordering intact.
alter table public.direct_messages
  add column if not exists reply_to_id uuid references public.direct_messages(id) on delete set null;

create index if not exists idx_direct_messages_reply on public.direct_messages (reply_to_id);

do $$ begin
  drop policy if exists "users delete own DMs" on public.direct_messages;
  create policy "users delete own DMs"
    on public.direct_messages for delete to authenticated
    using (sender_id = auth.uid());

  drop policy if exists "users update own DMs" on public.direct_messages;
  create policy "users update own DMs"
    on public.direct_messages for update to authenticated
    using (sender_id = auth.uid())
    with check (sender_id = auth.uid());
end $$;

-- ── 6. Announcements: re-assert admin broadcast policy ───────────────────────
do $$ begin
  drop policy if exists "admins insert notifications" on public.notifications;
  create policy "admins insert notifications"
    on public.notifications for insert to authenticated with check (public.is_admin());
end $$;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- select tablename, policyname from pg_policies
--   where tablename in ('syllabus_items','promos','direct_messages','notifications')
--   order by tablename, policyname;
-- select id, public from storage.buckets where id in ('syllabus','promos');
