-- Already applied to the "JAmb CBT" project on 6 Oct 2026 (kept here so the repo matches the database).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.increment_reply_count() from public, anon, authenticated;
revoke execute on function public.qubit_gen_user_code() from public, anon, authenticated;

create index if not exists idx_posts_user_id on public.posts (user_id);
create index if not exists idx_post_replies_user_id on public.post_replies (user_id);
create index if not exists idx_post_likes_user_id on public.post_likes (user_id);
create index if not exists idx_quiz_invites_from_id on public.quiz_invites (from_id);
create index if not exists idx_quiz_invites_match_id on public.quiz_invites (match_id);
create index if not exists idx_quiz_matches_winner_id on public.quiz_matches (winner_id);
create index if not exists idx_discount_redemptions_user_id on public.discount_redemptions (user_id);
create index if not exists idx_discount_redemptions_payment_id on public.discount_redemptions (payment_id);
create index if not exists idx_user_achievements_achievement_id on public.user_achievements (achievement_id);
create index if not exists idx_leaderboard_history_user_id on public.leaderboard_history (user_id);
create index if not exists idx_content_reports_reporter_id on public.content_reports (reporter_id);
create index if not exists idx_exam_attempts_user_submitted on public.exam_attempts (user_id, submitted_at desc);
