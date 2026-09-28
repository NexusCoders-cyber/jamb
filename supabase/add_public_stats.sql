-- ─── Public profile stats (for viewing other students' profiles) ────────────
-- exam_attempts is RLS-locked to its owner, but profiles show achievements
-- derived from stats. This SECURITY DEFINER function exposes ONLY aggregate
-- numbers (exams, questions, accuracy, streak) for any authenticated caller —
-- never individual attempts. Idempotent.

create or replace function public.public_profile_stats(uid uuid)
returns table (exams int, questions int, accuracy int, streak int)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::int,
    coalesce(sum(a.question_count), 0)::int,
    case
      when coalesce(sum(a.question_count), 0) > 0
        then round(100.0 * sum(a.score) / sum(a.question_count))::int
      else 0
    end,
    (select p.streak_days from public.profiles p where p.id = uid)
  from public.exam_attempts a
  where a.user_id = uid and a.status = 'submitted';
$$;

grant execute on function public.public_profile_stats(uuid) to authenticated;
