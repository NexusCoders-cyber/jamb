-- ─── Community & Direct Messaging Schema ──────────────────────────────────────
-- Run this in the Supabase SQL editor after the base schema.sql

-- ── Community channels (fixed list, seeded below) ─────────────────────────────
create table if not exists public.channels (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

insert into public.channels (slug, name) values
  ('general',    'General Prep'),
  ('maths',      'Mathematics'),
  ('physics',    'Physics'),
  ('chemistry',  'Chemistry'),
  ('english',    'English Language'),
  ('biology',    'Biology'),
  ('government', 'Government'),
  ('economics',  'Economics'),
  ('exam-prep',  'Exam Prep')
on conflict (slug) do nothing;

-- ── Community posts ───────────────────────────────────────────────────────────
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  channel_id  uuid not null references public.channels(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 200),
  body        text not null check (char_length(body) between 1 and 5000),
  reply_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Post replies ──────────────────────────────────────────────────────────────
create table if not exists public.post_replies (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ── Direct messages ───────────────────────────────────────────────────────────
create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists posts_channel_idx      on public.posts(channel_id, created_at desc);
create index if not exists replies_post_idx       on public.post_replies(post_id, created_at asc);
create index if not exists dm_sender_idx          on public.direct_messages(sender_id, created_at desc);
create index if not exists dm_receiver_idx        on public.direct_messages(receiver_id, created_at desc);
create index if not exists dm_conversation_idx    on public.direct_messages(
  least(sender_id::text, receiver_id::text),
  greatest(sender_id::text, receiver_id::text),
  created_at asc
);

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.channels       enable row level security;
alter table public.posts          enable row level security;
alter table public.post_replies   enable row level security;
alter table public.direct_messages enable row level security;

-- ── RLS policies ─────────────────────────────────────────────────────────────
-- Channels: public read
create policy "channels are public"
  on public.channels for select using (true);

-- Posts: public read, authenticated insert/update/delete own
create policy "posts public read"
  on public.posts for select using (true);

create policy "posts authenticated insert"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "posts owner update"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "posts owner delete"
  on public.posts for delete
  using (auth.uid() = user_id);

-- Replies: public read, authenticated insert/delete own
create policy "replies public read"
  on public.post_replies for select using (true);

create policy "replies authenticated insert"
  on public.post_replies for insert
  with check (auth.uid() = user_id);

create policy "replies owner delete"
  on public.post_replies for delete
  using (auth.uid() = user_id);

-- DMs: only sender and receiver can see
create policy "dm participants read"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "dm sender insert"
  on public.direct_messages for insert
  with check (auth.uid() = sender_id);

create policy "dm receiver mark read"
  on public.direct_messages for update
  using (auth.uid() = receiver_id);

-- ── Auto-increment reply_count on posts ───────────────────────────────────────
create or replace function public.increment_reply_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.posts set reply_count = reply_count + 1, updated_at = now()
  where id = NEW.post_id;
  return NEW;
end;
$$;

drop trigger if exists on_reply_inserted on public.post_replies;
create trigger on_reply_inserted
  after insert on public.post_replies
  for each row execute procedure public.increment_reply_count();

-- ── Enable realtime for DMs and replies ───────────────────────────────────────
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.post_replies;
