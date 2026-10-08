-- ─────────────────────────────────────────────────────────────────────────────
-- Phone notifications (web push) + "notify students" for blog posts. Safe to run more than once.
-- Run in Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per phone/browser that switched notifications on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  topics text[] not null default '{blog,announcements}',   -- what this phone wants to hear about
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_topics_idx on public.push_subscriptions using gin (topics);
alter table public.push_subscriptions enable row level security;

-- Students can see and remove their own phones. Adding/changing goes through the server only (service role),
-- so nobody can register a subscription for someone else.
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- A blog post is announced once (re-saving or unpublishing/republishing does not notify again unless an admin asks).
alter table public.blog_posts add column if not exists notified_at timestamptz;

-- In-app notifications can link somewhere (e.g. the article).
alter table public.notifications add column if not exists url text;
