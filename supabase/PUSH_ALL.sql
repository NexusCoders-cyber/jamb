-- ══════════════════════════════════════════════════════════════════════════════
--  PUSH ALL — the complete set of schema changes still missing from the DB.
--  Paste this WHOLE FILE into the Supabase SQL editor and click Run.
--  Idempotent — safe to re-run as many times as you like.
--
--  Contains (in dependency order):
--    1. admin_and_blog.sql  — is_admin() + admin RLS policies + blog_posts
--    2. syllabus_promos_dm.sql — syllabus table+bucket, promos table+bucket,
--       DM reply_to_id + delete policy, admin announcement policy
--
--  Already applied elsewhere (no need to re-run, but harmless):
--  schema_safe.sql · fix_rls_and_snapshots.sql · add_interests.sql ·
--  add_avatar.sql · add_public_stats.sql · community.sql · suggested_people.sql
--
--  After running, promote yourself to admin:
--    update public.profiles set role = 'admin' where email = 'you@example.com';
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
--  PART 1 — Admin role + Blog  (admin_and_blog.sql)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Admin helper ───────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── 2. Admin policies (drop-then-create so re-runs never error) ───────────────
do $$ begin

  -- Profiles: admins can read every profile and change roles
  drop policy if exists "admins read all profiles" on public.profiles;
  create policy "admins read all profiles"
    on public.profiles for select to authenticated using (public.is_admin());

  drop policy if exists "admins update any profile" on public.profiles;
  create policy "admins update any profile"
    on public.profiles for update to authenticated using (public.is_admin());

  drop policy if exists "admins delete profiles" on public.profiles;
  create policy "admins delete profiles"
    on public.profiles for delete to authenticated using (public.is_admin());

  -- Exam oversight: read any attempt + its answers, delete bad data
  drop policy if exists "admins read all attempts" on public.exam_attempts;
  create policy "admins read all attempts"
    on public.exam_attempts for select to authenticated using (public.is_admin());

  drop policy if exists "admins delete attempts" on public.exam_attempts;
  create policy "admins delete attempts"
    on public.exam_attempts for delete to authenticated using (public.is_admin());

  drop policy if exists "admins read all attempt answers" on public.attempt_answers;
  create policy "admins read all attempt answers"
    on public.attempt_answers for select to authenticated using (public.is_admin());

  drop policy if exists "admins delete attempt answers" on public.attempt_answers;
  create policy "admins delete attempt answers"
    on public.attempt_answers for delete to authenticated using (public.is_admin());

  -- Payments: admin oversight (read-only)
  drop policy if exists "admins read all payments" on public.payments;
  create policy "admins read all payments"
    on public.payments for select to authenticated using (public.is_admin());

  -- Community moderation
  drop policy if exists "admins update any post" on public.posts;
  create policy "admins update any post"
    on public.posts for update to authenticated using (public.is_admin());

  drop policy if exists "admins delete any post" on public.posts;
  create policy "admins delete any post"
    on public.posts for delete to authenticated using (public.is_admin());

  drop policy if exists "admins delete any reply" on public.post_replies;
  create policy "admins delete any reply"
    on public.post_replies for delete to authenticated using (public.is_admin());

  drop policy if exists "admins manage channels" on public.channels;
  create policy "admins manage channels"
    on public.channels for all to authenticated using (public.is_admin())
    with check (public.is_admin());

  -- DM abuse review (read-only)
  drop policy if exists "admins read all DMs" on public.direct_messages;
  create policy "admins read all DMs"
    on public.direct_messages for select to authenticated using (public.is_admin());

  -- Notifications: admin can broadcast
  drop policy if exists "admins insert notifications" on public.notifications;
  create policy "admins insert notifications"
    on public.notifications for insert to authenticated with check (public.is_admin());

end $$;

-- ── 3. Blog posts ─────────────────────────────────────────────────────────────
create table if not exists public.blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null default '',
  body        text not null default '',
  cover_image text,
  tags        text[] not null default '{}',
  author_id   uuid references public.profiles(id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_blog_posts_published
  on public.blog_posts (is_published, published_at desc);

alter table public.blog_posts enable row level security;

do $$ begin
  drop policy if exists "published posts are public" on public.blog_posts;
  create policy "published posts are public"
    on public.blog_posts for select using (is_published = true);

  drop policy if exists "admins manage blog posts" on public.blog_posts;
  create policy "admins manage blog posts"
    on public.blog_posts for all to authenticated using (public.is_admin())
    with check (public.is_admin());
end $$;


-- ══════════════════════════════════════════════════════════════════════════════
--  PART 2 — Syllabus · Promos · DM replies/delete  (syllabus_promos_dm.sql)
-- ══════════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════════
--  VERIFY — uncomment the block below and Run again to see the results.
-- ══════════════════════════════════════════════════════════════════════════════
-- select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('blog_posts','syllabus_items','promos','direct_messages','notifications')
--   order by tablename, policyname;
-- select id, public from storage.buckets where id in ('syllabus','promos','avatars');
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='direct_messages' and column_name='reply_to_id';
