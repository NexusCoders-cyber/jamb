-- ─── Admin role + Blog ────────────────────────────────────────────────────────
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- 1. is_admin(): SECURITY DEFINER helper so RLS policies can grant admins
--    elevated access without recursive profile lookups.
-- 2. Admin policies: manage users, review/delete any exam attempt, moderate
--    community posts/replies/channels.
-- 3. blog_posts table: admin-authored SEO articles, public read when published.
--
-- After running, promote yourself:
--   update public.profiles set role = 'admin' where email = 'you@example.com';

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

-- ── 4. Verify ─────────────────────────────────────────────────────────────────
-- select policyname, tablename from pg_policies where policyname like '%admins%';
-- \d public.blog_posts
