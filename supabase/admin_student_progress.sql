-- ─── Admin: per-student target tracking ──────────────────────────────────────
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- admin_student_progress() returns one row per student with:
--   · exams / questions / accuracy  (same numbers the student sees)
--   · jamb_estimate                 (question-weighted JAMB 400-scale score)
--   · target_score                  (their profile target)
--   · progress_pct / on_track       (estimate vs target)
--   · last_exam_at                  (recency)
--
-- Admin-only: guarded by is_admin(); RLS still applies to the underlying
-- tables for non-admin callers (they get zero rows rather than an error).

create or replace function public.admin_student_progress()
returns table (
  id            uuid,
  full_name     text,
  email         text,
  avatar_url    text,
  course        text,
  exams         int,
  questions     int,
  accuracy      int,
  jamb_estimate int,
  target_score  int,
  progress_pct  int,
  on_track      boolean,
  last_exam_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.avatar_url,
    p.course,
    coalesce(a.exams, 0)::int,
    coalesce(a.questions, 0)::int,
    coalesce(a.accuracy, 0)::int,
    coalesce(a.jamb_estimate, 0)::int,
    p.target_score,
    case when coalesce(a.jamb_estimate, 0) > 0 and p.target_score > 0
         then least(100, round(100.0 * a.jamb_estimate / p.target_score)::int)
         else 0 end::int,
    coalesce(a.jamb_estimate, 0) >= p.target_score,
    a.last_exam_at
  from public.profiles p
  left join (
    select
      user_id,
      count(*)::int                                                    as exams,
      sum(question_count)::int                                         as questions,
      round(100.0 * sum(score) / sum(question_count))::int             as accuracy,
      round(400.0 * sum(score) / sum(question_count))::int             as jamb_estimate,
      max(submitted_at)                                                as last_exam_at
    from public.exam_attempts
    where status = 'submitted' and question_count > 0
    group by user_id
  ) a on a.user_id = p.id
  order by coalesce(a.jamb_estimate, 0) desc;
$$;

revoke execute on function public.admin_student_progress() from public, anon;
grant execute on function public.admin_student_progress() to authenticated;
