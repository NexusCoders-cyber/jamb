/**
 * Supabase data-access helpers.
 * All functions accept a Supabase client so they work from both
 * server components (createSupabaseServerClient) and client components
 * (createSupabaseBrowserClient).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Rich text segment — italics/bold preserved from the ALOC API
export type SnapshotSegment = { text: string; italic?: boolean; bold?: boolean };

// Shape of the per-answer question snapshot stored in attempt_answers.question_data
export type QuestionSnapshot = {
  id: string;
  prompt: string;
  /** Italics/bold segments for the prompt (English lexis questions mark keywords) */
  prompt_segments?: SnapshotSegment[] | null;
  options: string[];
  /** Italics/bold segments per option, aligned with `options` by index */
  option_segments?: (SnapshotSegment[] | null)[] | null;
  /** Passage / instruction text shown above the question */
  section?: string | null;
  section_kind?: "passage" | "instruction" | null;
  /** Question illustration image URL */
  image?: string | null;
  /** All diagrams for the question */
  images?: string[] | null;
  /** Picture for each answer option, aligned with `options` */
  option_images?: (string | null)[] | null;
  section_images?: string[] | null;
  explanation_images?: string[] | null;
  /** Set text the question is drawn from (e.g. "Sweet Sixteen") */
  novel?: string | null;
  correct_option: number;
  explanation: string | null;
  difficulty: string;
  subject_name?: string | null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: "student" | "admin";
  target_score: number;
  streak_days: number;
  /** Subjects the student is preparing for — used by the friends browser */
  interests?: string[] | null;
  /** Desired course of study, shown on the students browser */
  course?: string | null;
  /** Public URL of the user's avatar in the `avatars` storage bucket */
  avatar_url?: string | null;
  /** Short bio shown on the profile page */
  bio?: string | null;
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
  question?: QuestionSnapshot;
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
  updates: Partial<Pick<Profile, "full_name" | "target_score" | "streak_days" | "avatar_url" | "bio" | "interests" | "course">>,
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
    /** Full question snapshot so review/mistakes can render without a join */
    question?: QuestionSnapshot;
  }>,
): Promise<void> {
  if (answers.length === 0) return;
  const { error } = await supabase.from("attempt_answers").upsert(
    answers.map((a) => ({
      question_id: a.question_id,
      selected_option: a.selected_option,
      is_correct: a.is_correct,
      marked_for_review: a.marked_for_review,
      ...(a.question ? { question_data: a.question } : {}),
      attempt_id: attemptId,
      answered_at: new Date().toISOString(),
    })),
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw error;
}

export async function getAttemptAnswers(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<AttemptAnswer[]> {
  const { data, error } = await supabase
    .from("attempt_answers")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("answered_at", { ascending: true });
  if (error) {
    console.error("getAttemptAnswers failed:", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as AttemptAnswer),
    question: (row.question_data as QuestionSnapshot | null) ?? undefined,
  }));
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
 * for a user. Reads subject_name from the stored question snapshot.
 */
export async function getSubjectStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubjectStats[]> {
  // Fetch all answered questions for submitted attempts
  const { data: attemptIds, error: idsError } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "submitted");

  if (idsError) {
    console.error("getSubjectStats (attempt ids) failed:", idsError.message);
    return [];
  }
  const idList = attemptIds?.map((a: { id: string }) => a.id) ?? [];
  if (idList.length === 0) return [];

  const { data: answers, error } = await supabase
    .from("attempt_answers")
    .select("is_correct, question_data")
    .in("attempt_id", idList);

  if (error) {
    console.error("getSubjectStats failed:", error.message);
    return [];
  }

  // Aggregate by subject (from snapshot)
  const map = new Map<string, { total: number; correct: number }>();
  for (const row of (answers ?? []) as Array<{
    is_correct: boolean | null;
    question_data: QuestionSnapshot | null;
  }>) {
    const name = row.question_data?.subject_name ?? "Unknown";
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
    .order("submitted_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

/**
 * Returns questions the user got wrong, grouped ready for the mistakes page.
 */
export async function getWrongAnswers(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<AttemptAnswer[]> {
  const { data: attemptIds, error: idsError } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "submitted");

  if (idsError) {
    console.error("getWrongAnswers (attempt ids) failed:", idsError.message);
    return [];
  }
  if (!attemptIds || attemptIds.length === 0) return [];

  const { data, error } = await supabase
    .from("attempt_answers")
    .select("*")
    .in(
      "attempt_id",
      attemptIds.map((a: { id: string }) => a.id),
    )
    .eq("is_correct", false)
    .limit(limit);

  if (error) {
    console.error("getWrongAnswers failed:", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as AttemptAnswer),
    question: (row.question_data as QuestionSnapshot | null) ?? undefined,
  }));
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
  author?: { full_name: string; avatar_url?: string | null };
  channel?: { name: string; slug: string };
};

export type PostReply = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string; avatar_url?: string | null };
};

export type DirectMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender?: { full_name: string; avatar_url?: string | null };
  receiver?: { full_name: string; avatar_url?: string | null };
  /** Message this one replies to (WhatsApp-style quote) */
  reply_to_id?: string | null;
  reply_to?: { id: string; body: string; sender_id: string } | null;
};

export type DMThread = {
  partner_id: string;
  partner_name: string;
  partner_avatar_url?: string | null;
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
    .select("*, author:profiles(full_name, avatar_url), channel:channels(name,slug)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data } = await q;
  return (data ?? []) as Post[];
}

/** Look up a community channel by its slug (used by /community/[slug]). */
export async function getChannelBySlug(supabase: SupabaseClient, slug: string): Promise<Channel | null> {
  const { data } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .single();
  return (data as Channel | null) ?? null;
}

export async function getPost(supabase: SupabaseClient, postId: string): Promise<Post | null> {
  const { data } = await supabase
    .from("posts")
    .select("*, author:profiles(full_name, avatar_url), channel:channels(name,slug)")
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
    .select("*, author:profiles(full_name, avatar_url), channel:channels(name,slug)")
    .single();
  return data as Post | null;
}

// Replies
export async function getReplies(supabase: SupabaseClient, postId: string): Promise<PostReply[]> {
  const { data } = await supabase
    .from("post_replies")
    .select("*, author:profiles(full_name, avatar_url)")
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
    .select("*, author:profiles(full_name, avatar_url)")
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
    .select("*, sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  return (data ?? []) as DirectMessage[];
}

export async function sendDM(
  supabase: SupabaseClient,
  senderId: string,
  receiverId: string,
  body: string,
  replyToId?: string | null,
): Promise<DirectMessage | null> {
  const { data } = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, body, reply_to_id: replyToId ?? null })
    .select("*, reply_to:direct_messages!reply_to_id(id, body, sender_id), sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .single();
  return data as DirectMessage | null;
}

/** Delete one of MY messages (RLS: only the sender can delete). */
export async function deleteDM(supabase: SupabaseClient, messageId: string): Promise<boolean> {
  const { error } = await supabase.from("direct_messages").delete().eq("id", messageId);
  return !error;
}

// ─── Syllabus (admin-managed, per subject) ────────────────────────────────────

export type SyllabusItem = {
  id: string;
  subject: string;
  title: string;
  body: string;
  file_url: string | null;
  file_name: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

/** All syllabus entries for one subject, in display order. */
export async function getSyllabusForSubject(
  supabase: SupabaseClient,
  subject: string,
): Promise<SyllabusItem[]> {
  const { data } = await supabase
    .from("syllabus_items")
    .select("*")
    .eq("subject", subject)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as SyllabusItem[];
}

/** Every syllabus entry (admin management list). */
export async function getAllSyllabus(supabase: SupabaseClient): Promise<SyllabusItem[]> {
  const { data } = await supabase
    .from("syllabus_items")
    .select("*")
    .order("subject", { ascending: true })
    .order("position", { ascending: true });
  return (data ?? []) as SyllabusItem[];
}

// ─── Promos (dashboard banner carousel) ──────────────────────────────────────

export type Promo = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

/** Active promos for the dashboard banner, in display order. */
export async function getActivePromos(supabase: SupabaseClient): Promise<Promo[]> {
  const { data } = await supabase
    .from("promos")
    .select("*")
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as unknown) as Promo[];
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
    .select("*, sender:profiles!sender_id(id,full_name,avatar_url), receiver:profiles!receiver_id(id,full_name,avatar_url)")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return [];

  // Group by conversation partner
  const threadMap = new Map<string, DMThread>();
  for (const msg of data as (DirectMessage & {
    sender: { id: string; full_name: string; avatar_url?: string | null };
    receiver: { id: string; full_name: string; avatar_url?: string | null };
  })[]) {
    const isMe = msg.sender_id === userId;
    const partnerId = isMe ? msg.receiver_id : msg.sender_id;
    const partner = isMe ? msg.receiver : msg.sender;
    if (!threadMap.has(partnerId)) {
      threadMap.set(partnerId, {
        partner_id: partnerId,
        partner_name: partner?.full_name ?? "User",
        partner_avatar_url: partner?.avatar_url ?? null,
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

/** Calendar date (YYYY-MM-DD) in Nigeria/Lagos time — students live in UTC+1,
 *  so the streak "day" must flip at Lagos midnight, not UTC. */
function lagosDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof d === "string" ? new Date(d) : d);
}

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

  const today = lagosDate(new Date());
  const yesterday = lagosDate(new Date(Date.now() - 86400000));

  // Attempts submitted today (Lagos time) — more than one means already counted
  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("id, submitted_at")
    .eq("user_id", userId)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(50);

  const submitted = (attempts ?? [])
    .map((a: { submitted_at: string | null }) => a.submitted_at)
    .filter(Boolean) as string[];

  const lagosDays = submitted.map((d) => lagosDate(d));
  const todayCount = lagosDays.filter((d) => d === today).length;

  if (todayCount > 1) {
    // Already counted today
    return;
  }
  if (todayCount === 1) {
    // First submission today: yesterday's attempt decides increment vs reset
    const lastDate = lagosDays.find((d) => d !== today);
    const newStreak = lastDate === yesterday ? (profile.streak_days ?? 0) + 1 : 1;
    await updateProfile(supabase, userId, { streak_days: newStreak });
    return;
  }

  // No submission today — nothing to update yet
}

/** Unread direct-message count for nav badges. */
export async function getUnreadDMCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

// ─── People you may know (real chat-graph mutuals) ───────────────────────────

export type SuggestedPerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  course: string | null;
  interests: string[] | null;
  streak_days: number | null;
  /** How many of MY chat partners have also chatted with this person */
  mutual_count: number;
};

/**
 * Suggested people ranked by real mutual-friend count, computed server-side
 * by the suggested_people() RPC (SECURITY DEFINER — the client can only ever
 * see its own DMs, so the chat-graph walk must happen in the database).
 * Excludes existing chat partners. Returns [] when the migration hasn't run.
 */
export async function getSuggestedPeople(
  supabase: SupabaseClient,
): Promise<SuggestedPerson[]> {
  const { data, error } = await supabase.rpc("suggested_people");
  if (error) {
    // 404/undefined function = migration not applied yet — degrade silently
    console.warn("suggested_people unavailable:", error.message);
    return [];
  }
  return (data ?? []) as SuggestedPerson[];
}

/**
 * Broadcast an announcement: one notification row per profile.
 * RLS allows admin inserts; non-admins get an error back.
 */
export async function sendAnnouncement(
  supabase: SupabaseClient,
  title: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id");
  if (pErr) return { ok: false, error: pErr.message };
  const rows = (profiles ?? []).map((p: { id: string }) => ({
    user_id: p.id,
    title,
    body,
  }));
  if (rows.length === 0) return { ok: true };
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
