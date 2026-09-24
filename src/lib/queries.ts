/**
 * Supabase data-access helpers.
 * All functions accept a Supabase client so they work from both
 * server components (createSupabaseServerClient) and client components
 * (createSupabaseBrowserClient).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: "student" | "admin";
  target_score: number;
  streak_days: number;
  created_at: string;
  updated_at: string;
};

export type Subject = {
  id: string;
  name: string;
  slug: string;
};

export type Question = {
  id: string;
  subject_id: string;
  prompt: string;
  options: string[];
  correct_option: number;
  explanation: string | null;
  difficulty: string;
};

export type ExamAttempt = {
  id: string;
  user_id: string;
  subject_id: string | null;
  question_count: number;
  status: "in_progress" | "submitted" | "expired";
  score: number;
  started_at: string;
  submitted_at: string | null;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: number | null;
  is_correct: boolean | null;
  marked_for_review: boolean;
  answered_at: string | null;
  question?: Question;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data ?? null;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "target_score" | "streak_days">>,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  return error;
}

// ─── Subjects ────────────────────────────────────────────────────────────────

export async function getSubjects(supabase: SupabaseClient): Promise<Subject[]> {
  const { data } = await supabase.from("subjects").select("*").order("name");
  return data ?? [];
}

// ─── Questions ───────────────────────────────────────────────────────────────

export async function getPublishedQuestions(
  supabase: SupabaseClient,
  subjectId: string,
  limit = 60,
): Promise<Question[]> {
  const { data } = await supabase
    .from("questions")
    .select("id, subject_id, prompt, options, correct_option, explanation, difficulty")
    .eq("subject_id", subjectId)
    .eq("is_published", true)
    .limit(limit);
  return (data ?? []) as Question[];
}

// ─── Exam Attempts ───────────────────────────────────────────────────────────

export async function createAttempt(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string | null,
  questionCount: number,
): Promise<ExamAttempt | null> {
  const { data } = await supabase
    .from("exam_attempts")
    .insert({ user_id: userId, subject_id: subjectId, question_count: questionCount })
    .select()
    .single();
  return data ?? null;
}

export async function getAttempt(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<ExamAttempt | null> {
  const { data } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();
  return data ?? null;
}

export async function submitAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  score: number,
): Promise<void> {
  await supabase
    .from("exam_attempts")
    .update({ status: "submitted", score, submitted_at: new Date().toISOString() })
    .eq("id", attemptId);
}

export async function getUserAttempts(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<ExamAttempt[]> {
  const { data } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ─── Attempt Answers ─────────────────────────────────────────────────────────

export async function saveAnswers(
  supabase: SupabaseClient,
  attemptId: string,
  answers: Array<{
    question_id: string;
    selected_option: number | null;
    is_correct: boolean;
    marked_for_review: boolean;
  }>,
): Promise<void> {
  if (answers.length === 0) return;
  await supabase.from("attempt_answers").upsert(
    answers.map((a) => ({
      ...a,
      attempt_id: attemptId,
      answered_at: new Date().toISOString(),
    })),
    { onConflict: "attempt_id,question_id" },
  );
}

export async function getAttemptAnswers(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<AttemptAnswer[]> {
  const { data } = await supabase
    .from("attempt_answers")
    .select("*, question:questions(id, subject_id, prompt, options, correct_option, explanation, difficulty)")
    .eq("attempt_id", attemptId);
  return (data ?? []) as AttemptAnswer[];
}

// ─── Analytics helpers ───────────────────────────────────────────────────────

export type SubjectStats = {
  subjectName: string;
  total: number;
  correct: number;
  accuracy: number;
};

/**
 * Returns per-subject accuracy derived from all submitted attempt_answers
 * for a user.  Requires a join via exam_attempts → attempt_answers → questions → subjects.
 */
export async function getSubjectStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubjectStats[]> {
  // Fetch all answered questions for submitted attempts
  const { data: answers } = await supabase
    .from("attempt_answers")
    .select(`
      is_correct,
      question:questions(
        subject_id,
        subject:subjects(name)
      )
    `)
    .in(
      "attempt_id",
      (
        await supabase
          .from("exam_attempts")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "submitted")
      ).data?.map((a: { id: string }) => a.id) ?? [],
    );

  if (!answers) return [];

  // Aggregate by subject
  const map = new Map<string, { total: number; correct: number }>();
  for (const row of answers as unknown as Array<{
    is_correct: boolean | null;
    question: { subject: { name: string } | null } | null;
  }>) {
    const name = row.question?.subject?.name;
    if (!name) continue;
    const entry = map.get(name) ?? { total: 0, correct: 0 };
    entry.total += 1;
    if (row.is_correct) entry.correct += 1;
    map.set(name, entry);
  }

  return Array.from(map.entries()).map(([subjectName, { total, correct }]) => ({
    subjectName,
    total,
    correct,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
  }));
}

/**
 * Returns the last N submitted attempt scores (for the score-over-time chart).
 */
export async function getScoreHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<Array<{ score: number; question_count: number; submitted_at: string }>> {
  const { data } = await supabase
    .from("exam_attempts")
    .select("score, question_count, submitted_at")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}

/**
 * Returns questions the user got wrong, grouped ready for the mistakes page.
 */
export async function getWrongAnswers(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<AttemptAnswer[]> {
  const { data: attemptIds } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "submitted");

  if (!attemptIds || attemptIds.length === 0) return [];

  const { data } = await supabase
    .from("attempt_answers")
    .select(
      "*, question:questions(id, subject_id, prompt, options, correct_option, explanation, difficulty, subject:subjects(name))",
    )
    .in(
      "attempt_id",
      attemptIds.map((a: { id: string }) => a.id),
    )
    .eq("is_correct", false)
    .limit(limit);

  return (data ?? []) as AttemptAnswer[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function getNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

// ─── Community ────────────────────────────────────────────────────────────────

export type Channel = { id: string; slug: string; name: string };

export type Post = {
  id: string;
  user_id: string;
  channel_id: string;
  title: string;
  body: string;
  reply_count: number;
  created_at: string;
  author?: { full_name: string };
  channel?: { name: string; slug: string };
};

export type PostReply = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string };
};

export type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender?: { full_name: string };
  receiver?: { full_name: string };
};

export type DMThread = {
  partner_id: string;
  partner_name: string;
  last_message: string;
  last_at: string;
  unread: number;
};

// Channels
export async function getChannels(supabase: SupabaseClient): Promise<Channel[]> {
  const { data } = await supabase.from("channels").select("*").order("name");
  return data ?? [];
}

// Posts
export async function getPosts(
  supabase: SupabaseClient,
  channelId?: string,
  limit = 30,
): Promise<Post[]> {
  let q = supabase
    .from("posts")
    .select("*, author:profiles(full_name), channel:channels(name,slug)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data } = await q;
  return (data ?? []) as Post[];
}

export async function getPost(supabase: SupabaseClient, postId: string): Promise<Post | null> {
  const { data } = await supabase
    .from("posts")
    .select("*, author:profiles(full_name), channel:channels(name,slug)")
    .eq("id", postId)
    .single();
  return data as Post | null;
}

export async function createPost(
  supabase: SupabaseClient,
  userId: string,
  channelId: string,
  title: string,
  body: string,
): Promise<Post | null> {
  const { data } = await supabase
    .from("posts")
    .insert({ user_id: userId, channel_id: channelId, title, body })
    .select("*, author:profiles(full_name), channel:channels(name,slug)")
    .single();
  return data as Post | null;
}

// Replies
export async function getReplies(supabase: SupabaseClient, postId: string): Promise<PostReply[]> {
  const { data } = await supabase
    .from("post_replies")
    .select("*, author:profiles(full_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as PostReply[];
}

export async function createReply(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  body: string,
): Promise<PostReply | null> {
  const { data } = await supabase
    .from("post_replies")
    .insert({ user_id: userId, post_id: postId, body })
    .select("*, author:profiles(full_name)")
    .single();
  return data as PostReply | null;
}

// Direct Messages
export async function getDMThread(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string,
): Promise<DirectMessage[]> {
  const { data } = await supabase
    .from("direct_messages")
    .select("*, sender:profiles!sender_id(full_name), receiver:profiles!receiver_id(full_name)")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  return (data ?? []) as DirectMessage[];
}

export async function sendDM(
  supabase: SupabaseClient,
  senderId: string,
  receiverId: string,
  body: string,
): Promise<DirectMessage | null> {
  const { data } = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, body })
    .select("*, sender:profiles!sender_id(full_name), receiver:profiles!receiver_id(full_name)")
    .single();
  return data as DirectMessage | null;
}

export async function markDMsRead(
  supabase: SupabaseClient,
  receiverId: string,
  senderId: string,
): Promise<void> {
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", receiverId)
    .eq("sender_id", senderId)
    .is("read_at", null);
}

export async function getDMInbox(
  supabase: SupabaseClient,
  userId: string,
): Promise<DMThread[]> {
  // Get all DMs where user is sender or receiver
  const { data } = await supabase
    .from("direct_messages")
    .select("*, sender:profiles!sender_id(id,full_name), receiver:profiles!receiver_id(id,full_name)")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  // Group by conversation partner
  const threadMap = new Map<string, DMThread>();
  for (const msg of data as (DirectMessage & {
    sender: { id: string; full_name: string };
    receiver: { id: string; full_name: string };
  })[]) {
    const isMe = msg.sender_id === userId;
    const partnerId = isMe ? msg.receiver_id : msg.sender_id;
    const partnerName = isMe ? msg.receiver?.full_name : msg.sender?.full_name;
    if (!threadMap.has(partnerId)) {
      threadMap.set(partnerId, {
        partner_id: partnerId,
        partner_name: partnerName ?? "User",
        last_message: msg.body,
        last_at: msg.created_at,
        unread: !isMe && !msg.read_at ? 1 : 0,
      });
    } else {
      const t = threadMap.get(partnerId)!;
      if (!isMe && !msg.read_at) t.unread += 1;
    }
  }
  return Array.from(threadMap.values());
}

// ─── Streak management ────────────────────────────────────────────────────────

/**
 * Call after every exam submission.
 * - If the user has already submitted an exam today, do nothing.
 * - If the last submission was yesterday, increment streak.
 * - If more than 1 day has passed, reset streak to 1.
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const profile = await getProfile(supabase, userId);
  if (!profile) return;

  // Find the most recent PREVIOUS attempt (before today)
  const today = new Date().toISOString().slice(0, 10);

  const { data: todayAttempts } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .gte("submitted_at", `${today}T00:00:00.000Z`)
    .limit(2); // if >1 means we already counted today

  // Already updated today (more than 1 submitted today means streak was already counted)
  if ((todayAttempts?.length ?? 0) > 1) return;

  // Get last attempt before today
  const { data: lastAttempts } = await supabase
    .from("exam_attempts")
    .select("submitted_at")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .lt("submitted_at", `${today}T00:00:00.000Z`)
    .order("submitted_at", { ascending: false })
    .limit(1);

  const lastDate = lastAttempts?.[0]?.submitted_at?.slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let newStreak: number;
  if (!lastDate) {
    // First ever attempt
    newStreak = 1;
  } else if (lastDate === yesterday) {
    // Consecutive day
    newStreak = (profile.streak_days ?? 0) + 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  await updateProfile(supabase, userId, { streak_days: newStreak });
}
