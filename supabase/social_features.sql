-- ============================================================================
-- Qubit — Social features: user codes, friendships, follows, post likes
-- Run this ONCE in the Supabase dashboard → SQL Editor (idempotent).
-- Everything is guarded with IF NOT EXISTS / DO blocks so re-running is safe.
-- ============================================================================

-- ── 1. Short public user code (e.g. QB-7K3X9) ───────────────────────────────
alter table public.profiles add column if not exists user_code text;
create unique index if not exists profiles_user_code_key on public.profiles (user_code);

-- Backfill codes for existing users (skips anyone who already has one).
update public.profiles
set user_code = 'QB-' || upper(substr(md5(random()::text), 1, 5))
where user_code is null;

-- New accounts get a code automatically. Generates until it finds a free one.
create or replace function public.qubit_gen_user_code() returns trigger
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if new.user_code is null or new.user_code = '' then
    loop
      code := 'QB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
      exit when not exists (select 1 from public.profiles where user_code = code);
    end loop;
    new.user_code := code;
  end if;
  return new;
end $$;

drop trigger if exists profiles_user_code_trigger on public.profiles;
create trigger profiles_user_code_trigger
  before insert on public.profiles
  for each row execute function public.qubit_gen_user_code();

-- ── 2. Friendships (mutual request → accepted) ───────────────────────────────
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ── 3. Follows (one-way, like Instagram) ─────────────────────────────────────
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

-- ── 4. Post likes ────────────────────────────────────────────────────────────
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
create index if not exists post_likes_post_idx on public.post_likes (post_id);

-- ── 5. Post moderation columns (pin / soft delete) + optional title ─────────
alter table public.posts add column if not exists is_pinned boolean not null default false;
alter table public.posts add column if not exists deleted_at timestamptz;
-- Facebook-style posts: title becomes optional (body-only status updates).
alter table public.posts alter column title drop not null;

-- ── 5b. Content reports (users flag posts; admins act on them) ───────────────
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reply_id uuid references public.post_replies(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

-- ── 6. RLS on the new tables ─────────────────────────────────────────────────
alter table public.friendships enable row level security;
alter table public.follows     enable row level security;
alter table public.post_likes  enable row level security;

do $$
begin
  -- Friendships: you may read friendships you appear in; create your own
  -- outgoing requests; the addressee can accept/reject (update); both sides
  -- can remove. Admins can do anything.
  if not exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'friendships_select_participant') then
    create policy friendships_select_participant on public.friendships
      for select using (
        requester_id = auth.uid() or addressee_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'friendships_insert_requester') then
    create policy friendships_insert_requester on public.friendships
      for insert with check (requester_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'friendships_update_participant') then
    create policy friendships_update_participant on public.friendships
      for update using (
        requester_id = auth.uid() or addressee_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'friendships_delete_participant') then
    create policy friendships_delete_participant on public.friendships
      for delete using (
        requester_id = auth.uid() or addressee_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;

  -- Follows: public read (follower counts are shown on profiles),
  -- create/remove your own edges.
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_select_all') then
    create policy follows_select_all on public.follows for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_insert_self') then
    create policy follows_insert_self on public.follows for insert with check (follower_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'follows' and policyname = 'follows_delete_self') then
    create policy follows_delete_self on public.follows for delete using (follower_id = auth.uid());
  end if;

  -- Likes: public read, manage your own.
  if not exists (select 1 from pg_policies where tablename = 'content_reports' and policyname = 'content_reports_select_admin') then
    create policy content_reports_select_admin on public.content_reports
      for select using (
        reporter_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'content_reports' and policyname = 'content_reports_insert_auth') then
    create policy content_reports_insert_auth on public.content_reports
      for insert with check (reporter_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'content_reports' and policyname = 'content_reports_update_admin') then
    create policy content_reports_update_admin on public.content_reports
      for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'post_likes' and policyname = 'post_likes_select_all') then
    create policy post_likes_select_all on public.post_likes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'post_likes' and policyname = 'post_likes_insert_self') then
    create policy post_likes_insert_self on public.post_likes for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'post_likes' and policyname = 'post_likes_delete_self') then
    create policy post_likes_delete_self on public.post_likes for delete using (user_id = auth.uid());
  end if;
end $$;

-- Posts: allow admins to pin/unpin and soft-delete any post.
drop policy if exists posts_admin_update on public.posts;
create policy posts_admin_update on public.posts
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists posts_admin_delete on public.posts;
create policy posts_admin_delete on public.posts
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── 7. Notifications for friend requests (admin already inserts for others) ──
-- The app inserts notification rows client-side via the notifications table's
-- existing RLS; no extra objects needed here.

-- ── 8. Social counts for profile pages ─────────────────────────────────────
-- (Named public_social_stats — add_public_stats.sql already defines
-- public_profile_stats(uuid) with a different return shape.)
create or replace function public.public_social_stats(p_user uuid)
returns table (followers bigint, following bigint, friends bigint)
language sql security definer set search_path = public stable as $$
  select
    (select count(*) from public.follows where following_id = p_user),
    (select count(*) from public.follows where follower_id = p_user),
    (select count(*) from public.friendships
      where status = 'accepted' and (requester_id = p_user or addressee_id = p_user));
$$;
grant execute on function public.public_social_stats(uuid) to authenticated;

-- Done. Verify in the app: profiles get user_code, /community shows the feed.