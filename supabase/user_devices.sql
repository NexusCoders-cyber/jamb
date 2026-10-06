-- Device tracking + one-licence-per-paid-account (Pro works on the phone(s) that paid; a new phone must pay again).
-- Run once in Supabase → SQL Editor. Safe to re-run. Until it is run the app keeps working (it just doesn't lock devices).

create table if not exists public.user_devices (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  device_id    text not null,
  label        text,
  licensed     boolean not null default false,
  licensed_at  timestamptz,
  first_seen   timestamptz not null default now(),
  last_seen    timestamptz not null default now(),
  primary key (user_id, device_id)
);
create index if not exists idx_user_devices_user_last_seen on public.user_devices (user_id, last_seen desc);

alter table public.user_devices enable row level security;
drop policy if exists "users read own devices" on public.user_devices;
create policy "users read own devices" on public.user_devices
  for select to authenticated using ((select auth.uid()) = user_id);

-- mode: 'track' = record only; 'claim' = take a licence slot if one is free; 'force' = take a slot even when full
-- (moves the licence off the least recently used device — used right after a successful payment).
create or replace function public.claim_pro_device(
  p_user uuid, p_device text, p_label text, p_mode text, p_max int
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  is_licensed boolean;
  taken int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  insert into user_devices (user_id, device_id, label)
  values (p_user, p_device, left(p_label, 80))
  on conflict (user_id, device_id)
  do update set last_seen = now(), label = coalesce(excluded.label, user_devices.label);

  select licensed into is_licensed from user_devices where user_id = p_user and device_id = p_device;
  if is_licensed then return true; end if;
  if p_mode = 'track' then return false; end if;

  select count(*) into taken from user_devices where user_id = p_user and licensed;
  if taken >= greatest(p_max, 1) then
    if p_mode <> 'force' then return false; end if;
    update user_devices set licensed = false
    where ctid in (
      select ctid from user_devices
      where user_id = p_user and licensed
      order by last_seen asc
      limit (taken - greatest(p_max, 1) + 1)
    );
  end if;

  update user_devices set licensed = true, licensed_at = now() where user_id = p_user and device_id = p_device;
  return true;
end $$;

revoke execute on function public.claim_pro_device(uuid, text, text, text, int) from public, anon, authenticated;
grant execute on function public.claim_pro_device(uuid, text, text, text, int) to service_role;

-- How many phones one paid account may use Pro on (change the number to allow more).
insert into public.admin_settings (key, value) values ('pro_max_devices', '1')
on conflict (key) do nothing;
