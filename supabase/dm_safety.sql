-- ─────────────────────────────────────────────────────────────────────────────
-- Direct-message safety: block users, report abusive messages, admin can stop a user from messaging.
-- Safe to run more than once. Run in Supabase → SQL Editor.
-- (Google Play requires this for any app where users can message each other.)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Block list ---------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or coalesce(public.is_admin(), false));
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- 2. Admin "can't message" list (students cannot read or change it) -------------------
create table if not exists public.dm_bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text,
  banned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.dm_bans enable row level security;
drop policy if exists dm_bans_admin on public.dm_bans;
create policy dm_bans_admin on public.dm_bans for all to authenticated
  using (coalesce(public.is_admin(), false)) with check (coalesce(public.is_admin(), false));

-- 3. Reports ---------------------------------------------------------------------
create table if not exists public.dm_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid,                       -- not a foreign key: the sender may delete the message afterwards
  message_body text,                     -- snapshot, so admins still see it if it is deleted
  context jsonb,                         -- the few messages before it
  reason text not null check (reason in ('harassment','spam','inappropriate','scam','other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create unique index if not exists dm_reports_one_per_message on public.dm_reports (reporter_id, message_id) where message_id is not null;
create unique index if not exists dm_reports_one_open_per_user on public.dm_reports (reporter_id, reported_user_id) where message_id is null and status = 'open';
create index if not exists dm_reports_status_idx on public.dm_reports (status, created_at desc);
alter table public.dm_reports enable row level security;

drop policy if exists dm_reports_select on public.dm_reports;
create policy dm_reports_select on public.dm_reports for select to authenticated
  using (reporter_id = auth.uid() or coalesce(public.is_admin(), false));
drop policy if exists dm_reports_update_admin on public.dm_reports;
create policy dm_reports_update_admin on public.dm_reports for update to authenticated
  using (coalesce(public.is_admin(), false)) with check (coalesce(public.is_admin(), false));
-- No insert policy on purpose: reports are created only through report_dm() below, which checks and snapshots them.

create or replace function public.report_dm(p_user uuid, p_message uuid, p_reason text, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  m record;
  mbody text;
  reported uuid;
  ctx jsonb;
  new_id uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if p_reason is null or p_reason not in ('harassment','spam','inappropriate','scam','other') then raise exception 'bad_reason'; end if;
  if (select count(*) from public.dm_reports where reporter_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_reports';
  end if;

  if p_message is not null then
    select * into m from public.direct_messages where id = p_message and (sender_id = me or receiver_id = me);
    if not found then raise exception 'message_not_found'; end if;
    if m.sender_id = me then raise exception 'cannot_report_own_message'; end if;
    reported := m.sender_id;
    mbody := m.body;
    select coalesce(jsonb_agg(jsonb_build_object('from_reporter', x.sender_id = me, 'body', x.body, 'at', x.created_at) order by x.created_at), '[]'::jsonb)
      into ctx
      from (select sender_id, body, created_at from public.direct_messages
             where ((sender_id = me and receiver_id = reported) or (sender_id = reported and receiver_id = me))
               and created_at <= m.created_at
             order by created_at desc limit 6) x;
  else
    reported := p_user;
    if reported is null or reported = me or not exists (select 1 from public.profiles where id = reported) then raise exception 'user_not_found'; end if;
  end if;

  insert into public.dm_reports (reporter_id, reported_user_id, message_id, message_body, context, reason, note)
  values (me, reported, p_message, mbody, ctx, p_reason, nullif(left(trim(coalesce(p_note, '')), 500), ''))
  on conflict do nothing
  returning id into new_id;
  return new_id;  -- null when this exact report already existed
end $$;
revoke execute on function public.report_dm(uuid, uuid, text, text) from public, anon;
grant execute on function public.report_dm(uuid, uuid, text, text) to authenticated;

-- 4. Enforcement: nobody can message across a block, and banned users cannot send -------
create or replace function public.dm_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.dm_bans where user_id = new.sender_id) then
    raise exception 'dm_banned' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.user_blocks
     where (blocker_id = new.receiver_id and blocked_id = new.sender_id)
        or (blocker_id = new.sender_id and blocked_id = new.receiver_id)
  ) then
    raise exception 'dm_blocked' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists dm_guard_trg on public.direct_messages;
create trigger dm_guard_trg before insert on public.direct_messages for each row execute function public.dm_guard();

-- 5. Messages from someone I blocked disappear for me (thread, inbox and unread count) -------
drop policy if exists dm_hide_blocked on public.direct_messages;
create policy dm_hide_blocked on public.direct_messages as restrictive for select to authenticated
  using (
    coalesce(public.is_admin(), false)
    or not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = direct_messages.sender_id)
  );
