-- ─── People-you-may-know: real mutual-friends counts ─────────────────────────
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- suggested_people() computes, for the CALLING user (auth.uid() — never a
-- parameter, so one user cannot probe another's chat graph):
--   1. my chat partners (from direct_messages),
--   2. for every other user, how many of my partners have ALSO chatted with
--      them = mutual friends,
--   3. candidates ordered by mutuals desc, then same-course/subject affinity.
--
-- RLS-safe: SECURITY DEFINER, but filters out already-chatted users, never
-- exposes message content, and only exposes public profile fields.

create or replace function public.suggested_people()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  course text,
  interests text[],
  streak_days integer,
  mutual_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  with my_partners as (
    select distinct
      case when dm.sender_id = auth.uid() then dm.receiver_id else dm.sender_id end as partner_id
    from public.direct_messages dm
    where dm.sender_id = auth.uid() or dm.receiver_id = auth.uid()
  ),
  their_chats as (
    -- every (user, partner-of-user) chat edge in the platform
    select dm.sender_id as a, dm.receiver_id as b from public.direct_messages dm
    union all
    select dm.receiver_id as a, dm.sender_id as b from public.direct_messages dm
  ),
  mutuals as (
    select tc.b as candidate_id, count(distinct mp.partner_id) as mutual_count
    from my_partners mp
    join their_chats tc on tc.a = mp.partner_id
    where tc.b <> auth.uid()
      and tc.b not in (select partner_id from my_partners)
    group by tc.b
  )
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.course,
    p.interests,
    p.streak_days,
    coalesce(m.mutual_count, 0)::integer
  from public.profiles p
  left join mutuals m on m.candidate_id = p.id
  where p.id <> auth.uid()
    and p.id not in (select partner_id from my_partners)
  order by
    coalesce(m.mutual_count, 0) desc,
    (p.course = (select course from public.profiles where id = auth.uid())) desc nulls last,
    p.full_name asc
  limit 12;
$$;

grant execute on function public.suggested_people() to authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- select * from public.suggested_people();
