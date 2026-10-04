/**
 * Supabase data-access helpers.
 * All functions accept a Supabase client so they work from both
 * server components (createSupabaseServerClient) and client components
 * (createSupabaseBrowserClient).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteLocalAttempt,
  getLocalAttempt,
  getMeta,
  listLocalAttempts,
  setMeta,
  type LocalAttempt,
} from "./localDb";

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
  /** 0-based position in the whole paper — Review sorts by this so questions come back in exam order */
  position?: number;
  /** 1-based number inside its own subject (English 1-60, others 1-40), exactly as the student saw it */
  subject_number?: number;
  /** Questions that share a comprehension/cloze passage share this id */
  passage_id?: string | null;
  year?: string | null;
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
  /** Short public ID (e.g. QB-7K3X9) used for search + leaderboard display */
  user_code?: string | null;
  /** Premium status (Paystack): lifetime flag + monthly expiry */
  premium_lifetime?: boolean | null;
  premium_until?: string | null;
  /** Heartbeat for Facebook-style online dots (updated by AppShell) */
  last_seen_at?: string | null;
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
  if (isOnline()) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) {
        void setMeta(`profile:${userId}`, data); // so the app still opens with no connection
        return data as Profile;
      }
    } catch {
      /* use the saved copy below */
    }
  }
  return (await getMeta<Profile>(`profile:${userId}`)) ?? null;
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

// ─── Offline-first reads ─────────────────────────────────────────────────────
// Attempts are stored on the device first (lib/localDb.ts). The readers below merge those with whatever the
// cloud has (older attempts, other devices) so every page keeps working with no connection at all.

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function localToExamAttempt(a: LocalAttempt): ExamAttempt {
  return {
    id: a.id,
    user_id: a.userId,
    subject_id: null,
    question_count: a.questionCount,
    status: "submitted",
    score: a.score,
    started_at: a.startedAt,
    submitted_at: a.submittedAt,
  };
}

function localToAnswers(a: LocalAttempt): AttemptAnswer[] {
  const list: AttemptAnswer[] = a.answers.map((row, i) => ({
    id: `${a.id}:${i}`,
    attempt_id: a.id,
    question_id: row.question_id,
    selected_option: row.selected_option,
    is_correct: row.is_correct,
    marked_for_review: row.marked_for_review,
    answered_at: a.submittedAt,
    question: row.question,
  }));
  const hasPosition = list.length > 0 && list.every((r) => typeof r.question?.position === "number");
  return hasPosition ? list.sort((x, y) => (x.question!.position as number) - (y.question!.position as number)) : list;
}

function localToLite(a: LocalAttempt): AnswerLite[] {
  return a.answers.map((row) => ({
    attempt_id: a.id,
    subject: row.question?.subject_name || "Unknown",
    answered: row.selected_option !== null && row.selected_option !== undefined,
    correct: row.is_correct === true,
  }));
}

const REMOTE_HEADER_CACHE = "remoteAttempts";

/** Remember the cloud attempt list so History/Analytics still show older attempts when the phone is offline. */
async function cacheRemoteAttempts(list: ExamAttempt[]): Promise<void> {
  if (list.length === 0) return;
  try {
    const current = (await getMeta<Record<string, ExamAttempt>>(REMOTE_HEADER_CACHE)) ?? {};
    for (const a of list) current[a.id] = a;
    const newest = Object.values(current)
      .sort((x, y) => (y.submitted_at ?? "").localeCompare(x.submitted_at ?? ""))
      .slice(0, 400);
    await setMeta(REMOTE_HEADER_CACHE, Object.fromEntries(newest.map((a) => [a.id, a])));
  } catch {
    /* cache is a convenience only */
  }
}

async function cachedRemoteAttempts(userId: string): Promise<ExamAttempt[]> {
  try {
    const current = (await getMeta<Record<string, ExamAttempt>>(REMOTE_HEADER_CACHE)) ?? {};
    return Object.values(current).filter((a) => a.user_id === userId);
  } catch {
    return [];
  }
}

/** Attempts the student deleted on this device that the cloud has not been told about yet. */
async function deletedAttemptIds(userId: string): Promise<Set<string>> {
  return new Set((await getMeta<string[]>(`deletedAttempts:${userId}`)) ?? []);
}


export async function createAttempt(
  supabase: SupabaseClient,
  userId: string,
  subjectId: string | null,
  questionCount: number,
): Promise<ExamAttempt | null> {
  const { data, error } = await supabase
    .from("exam_attempts")
    .insert({ user_id: userId, subject_id: subjectId, question_count: questionCount })
    .select()
    .single();
  if (error) console.error("createAttempt failed:", describeSaveError(error));
  return data ?? null;
}

export async function getAttempt(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<ExamAttempt | null> {
  const local = await getLocalAttempt(attemptId);
  if (local) return localToExamAttempt(local);
  if (isOnline()) {
    try {
      const { data } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).single();
      if (data) return data as ExamAttempt;
    } catch {
      /* fall through to the cached copy */
    }
  }
  const cache = (await getMeta<Record<string, ExamAttempt>>(REMOTE_HEADER_CACHE)) ?? {};
  return cache[attemptId] ?? null;
}

export async function submitAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  score: number,
  /** Original finish time. Offline attempts are backed up later; they must keep the day they were taken. */
  submittedAt: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await supabase
    .from("exam_attempts")
    .update({ status: "submitted", score, submitted_at: submittedAt })
    .eq("id", attemptId);
  // A failed update used to vanish silently, leaving the attempt "in progress" and out of History/Analytics
  if (error) throw new Error(describeSaveError(error));
}

export async function getUserAttempts(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<ExamAttempt[]> {
  const [local, deleted] = await Promise.all([listLocalAttempts(userId), deletedAttemptIds(userId)]);
  let remote: ExamAttempt[] | null = null;
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(Math.max(limit, 50));
      if (!error && data) {
        remote = data as ExamAttempt[];
        void cacheRemoteAttempts(remote);
      }
    } catch {
      /* offline or blocked: the device copy below is enough */
    }
  }
  if (!remote) remote = await cachedRemoteAttempts(userId);

  const byId = new Map<string, ExamAttempt>();
  for (const a of remote) if (!deleted.has(a.id)) byId.set(a.id, a);
  for (const a of local) byId.set(a.id, localToExamAttempt(a)); // the device copy wins
  return Array.from(byId.values())
    .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
    .slice(0, limit);
}

/** Deletes the attempt on this device straight away and in the cloud when possible (otherwise on the next backup). */
export async function deleteAttempt(supabase: SupabaseClient, attemptId: string, userId?: string): Promise<boolean> {
  const local = await getLocalAttempt(attemptId);
  const owner = userId ?? local?.userId;
  await deleteLocalAttempt(attemptId);
  let remoteDone = false;
  if (isOnline()) {
    try {
      const { error } = await supabase.from("exam_attempts").delete().eq("id", attemptId);
      remoteDone = !error;
    } catch {
      remoteDone = false;
    }
  }
  if (!remoteDone && owner && (!local || local.syncedAt)) {
    // It exists in the cloud (or might): remember to remove it there on the next backup
    const key = `deletedAttempts:${owner}`;
    const list = new Set((await getMeta<string[]>(key)) ?? []);
    list.add(attemptId);
    await setMeta(key, Array.from(list));
  }
  return true;
}

// ─── Attempt Answers ─────────────────────────────────────────────────────────

/** A readable reason from a Supabase/Postgres error (they are plain objects, not Error instances). */
export function describeSaveError(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  const o = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const message = typeof o.message === "string" && o.message ? o.message : "Unknown error";
  const code = typeof o.code === "string" && o.code ? ` [${o.code}]` : "";
  return `${message}${code}`;
}

/** What had to be left out so the answers could be stored on an older database. */
export type SaveReport = {
  /** false: the saved copy of each question (question_data) could not be stored, so Review will be limited */
  snapshots: boolean;
  /** false: blank (unanswered) questions could not be stored */
  blanks: boolean;
};

type SaveAnswerInput = {
  question_id: string;
  /** null = the student left this question unanswered (it is still saved so Review can show it) */
  selected_option: number | null;
  /** null for unanswered questions, so the Mistakes page (which looks for `false`) is unaffected */
  is_correct: boolean | null;
  marked_for_review: boolean;
  /** Full question snapshot so review/mistakes can render without a join */
  question?: QuestionSnapshot;
};

export async function saveAnswers(
  supabase: SupabaseClient,
  attemptId: string,
  answers: SaveAnswerInput[],
): Promise<SaveReport> {
  const report: SaveReport = { snapshots: true, blanks: true };
  if (answers.length === 0) return report;

  // The table keeps one row per (attempt, question). A question id that appears twice in one paper
  // would make Postgres reject the whole batch, so repeats get a suffix.
  const seen = new Map<string, number>();
  const unique = answers.map((a) => {
    const n = (seen.get(a.question_id) ?? 0) + 1;
    seen.set(a.question_id, n);
    return n === 1 ? a : { ...a, question_id: `${a.question_id}~${n}` };
  });

  const build = () => {
    // one base time + index keeps rows in paper order even for pages that sort by answered_at
    const base = Date.now();
    return unique
      .filter((a) => report.blanks || a.selected_option !== null)
      .map((a, i) => ({
        question_id: a.question_id,
        selected_option: a.selected_option,
        is_correct: a.is_correct,
        marked_for_review: a.marked_for_review,
        ...(a.question && report.snapshots ? { question_data: a.question } : {}),
        attempt_id: attemptId,
        answered_at: new Date(base + i).toISOString(),
      }));
  };

  const BATCH = 40; // full 180-question papers carry passages + explanations
  // Up to two fallbacks for databases that were not migrated: first without the question copy, then without blanks.
  for (let round = 0; round < 3; round++) {
    const rows = build();
    let failure: { message?: string; code?: string; details?: string } | null = null;
    for (let i = 0; i < rows.length && !failure; i += BATCH) {
      const { error } = await supabase
        .from("attempt_answers")
        .upsert(rows.slice(i, i + BATCH), { onConflict: "attempt_id,question_id" });
      if (error) failure = error;
    }
    if (!failure) return report;

    const text = `${failure.message ?? ""} ${failure.details ?? ""}`;
    if (report.snapshots && /question_data/i.test(text)) {
      report.snapshots = false;
      continue;
    }
    if (report.blanks && (failure.code === "23502" || /null value|not-null|not null/i.test(text))) {
      report.blanks = false;
      continue;
    }
    throw new Error(describeSaveError(failure));
  }
  throw new Error("Could not save the answers.");
}

/**
 * Store a finished attempt: the attempt record (created now if starting the exam failed to create it),
 * every question, then the score. The score is recorded even when the answers could not be stored, so the
 * attempt still counts in History and the JAMB estimate. Safe to call again (it re-sends the same rows).
 */
export async function storeAttempt(
  supabase: SupabaseClient,
  opts: { userId: string; attemptId: string | null; questionCount: number; rows: SaveAnswerInput[]; score: number },
): Promise<{ attemptId: string | null; submitted: boolean; problem: string | null; note: string | null }> {
  let attemptId = opts.attemptId;
  let problem: string | null = null;
  let note: string | null = null;
  let submitted = false;

  try {
    if (!attemptId) {
      const created = await createAttempt(supabase, opts.userId, null, opts.questionCount);
      attemptId = created?.id ?? null;
    }
    if (!attemptId) return { attemptId: null, submitted: false, problem: "The attempt record could not be created.", note: null };

    try {
      const report = await saveAnswers(supabase, attemptId, opts.rows);
      if (!report.snapshots || !report.blanks) {
        console.warn("Attempt saved with reduced detail (database not fully migrated):", report);
        note = "This attempt was saved, but some details could not be stored, so Review may show less than usual.";
      }
    } catch (answersErr) {
      console.error("Saving answers failed:", answersErr);
      problem = describeSaveError(answersErr);
    }

    try {
      await submitAttempt(supabase, attemptId, opts.score);
      submitted = true;
    } catch (scoreErr) {
      console.error("Saving the score failed:", scoreErr);
      problem = problem ?? describeSaveError(scoreErr);
    }
  } catch (err) {
    console.error("Saving attempt failed:", err);
    problem = describeSaveError(err);
  }
  return { attemptId, submitted, problem, note };
}

export async function getAttemptAnswers(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<AttemptAnswer[]> {
  const local = await getLocalAttempt(attemptId);
  if (local) return localToAnswers(local);
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("attempt_answers")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("answered_at", { ascending: true });
  if (error) {
    console.error("getAttemptAnswers failed:", error.message);
    return [];
  }
  const list = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as AttemptAnswer),
    question: (row.question_data as QuestionSnapshot | null) ?? undefined,
  }));
  // Attempts saved after the position field existed come back in exact paper order;
  // older ones keep the database order (answered_at).
  const hasPosition = list.length > 0 && list.every((r) => typeof r.question?.position === "number");
  return hasPosition ? list.sort((a, b) => (a.question!.position as number) - (b.question!.position as number)) : list;
}

// ─── Analytics helpers ───────────────────────────────────────────────────────

export type SubjectStats = {
  subjectName: string;
  /** Questions the student actually answered in this subject */
  total: number;
  correct: number;
  /** correct ÷ answered, as a whole percentage */
  accuracy: number;
  /** Questions left blank (only recorded for attempts saved after unanswered rows were stored) */
  unanswered?: number;
};

/** One saved answer, reduced to what the statistics need (the full snapshot is large) */
export type AnswerLite = {
  attempt_id: string;
  subject: string;
  /** false = the student left it blank */
  answered: boolean;
  correct: boolean;
};

const ANSWER_PAGE = 1000;
const ANSWER_MAX_PAGES = 40;

type AnyRow = Record<string, unknown>;

function toAnswerLite(row: AnyRow): AnswerLite {
  const snapshot = row.question_data as { subject_name?: string | null } | null | undefined;
  const subject = (row.subject_name as string | null | undefined) ?? snapshot?.subject_name ?? "Unknown";
  return {
    attempt_id: String(row.attempt_id),
    subject: subject || "Unknown",
    answered: row.selected_option !== null && row.selected_option !== undefined,
    correct: row.is_correct === true,
  };
}

/**
 * Page through a query. Supabase returns at most 1000 rows per request, so a student with a few
 * full mock exams (180 answers each) used to have their statistics silently cut off.
 * Returns null if any page fails so the caller can fall back.
 */
async function fetchAllPages(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<AnyRow[] | null> {
  const out: AnyRow[] = [];
  for (let i = 0; i < ANSWER_MAX_PAGES; i++) {
    const from = i * ANSWER_PAGE;
    const { data, error } = await page(from, from + ANSWER_PAGE - 1);
    if (error) {
      console.error(`${label} failed:`, error.message);
      return null;
    }
    const rows = (data ?? []) as AnyRow[];
    out.push(...rows);
    if (rows.length < ANSWER_PAGE) break;
  }
  return out;
}

/**
 * Every answer row for the user's submitted attempts, lightweight.
 *  1. Fast path: one joined query that returns only the columns we need.
 *  2. Fallback (older database setups): attempt ids in chunks + the full snapshot.
 */
/**
 * Answer rows for a handful of attempts (e.g. the dashboard's "Revisit" sessions).
 * Much lighter than getAnswerRows(): only the requested attempts are read, so it stays well under
 * Supabase's 1000-row page (5 mocks × 180 answers = 900). Returns [] on any failure so callers degrade quietly.
 */
export async function getAnswerRowsForAttempts(supabase: SupabaseClient, attemptIds: string[]): Promise<AnswerLite[]> {
  const ids = Array.from(new Set(attemptIds)).slice(0, 5);
  if (ids.length === 0) return [];
  const out: AnswerLite[] = [];
  const remoteIds: string[] = [];
  for (const id of ids) {
    const local = await getLocalAttempt(id);
    if (local) out.push(...localToLite(local));
    else remoteIds.push(id);
  }
  if (remoteIds.length === 0 || !isOnline()) return out;
  try {
    const { data, error } = await supabase
      .from("attempt_answers")
      .select("attempt_id, selected_option, is_correct, subject_name:question_data->>subject_name")
      .in("attempt_id", remoteIds)
      .limit(1000);
    if (error || !data) return out;
    return [...out, ...(data as AnyRow[]).map(toAnswerLite)];
  } catch {
    return out;
  }
}

export async function getAnswerRows(supabase: SupabaseClient, userId: string): Promise<AnswerLite[]> {
  const local = await listLocalAttempts(userId);
  const localIds = new Set(local.map((a) => a.id));
  const deleted = await deletedAttemptIds(userId);
  const mine = local.flatMap(localToLite);
  if (!isOnline()) return mine;
  let remote: AnswerLite[] = [];
  try {
    remote = await getRemoteAnswerRows(supabase, userId);
  } catch {
    remote = [];
  }
  // Attempts that exist both here and in the cloud are counted once (the device copy)
  return [...remote.filter((r) => !localIds.has(r.attempt_id) && !deleted.has(r.attempt_id)), ...mine];
}

async function getRemoteAnswerRows(supabase: SupabaseClient, userId: string): Promise<AnswerLite[]> {
  const fast = await fetchAllPages(
    (from, to) =>
      supabase
        .from("attempt_answers")
        .select("id, attempt_id, selected_option, is_correct, subject_name:question_data->>subject_name, exam_attempts!inner(user_id, status)")
        .eq("exam_attempts.user_id", userId)
        .eq("exam_attempts.status", "submitted")
        .order("id", { ascending: true })
        .range(from, to),
    "getAnswerRows (joined)",
  );
  if (fast) return fast.map(toAnswerLite);

  const ids = await fetchAllPages(
    (from, to) =>
      supabase
        .from("exam_attempts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "submitted")
        .order("id", { ascending: true })
        .range(from, to),
    "getAnswerRows (attempt ids)",
  );
  if (!ids || ids.length === 0) return [];
  const idList = ids.map((r) => String(r.id));
  const out: AnswerLite[] = [];
  for (let i = 0; i < idList.length; i += 40) {
    const chunk = idList.slice(i, i + 40);
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("attempt_answers")
          .select("id, attempt_id, selected_option, is_correct, question_data")
          .in("attempt_id", chunk)
          .order("id", { ascending: true })
          .range(from, to),
      "getAnswerRows (chunk)",
    );
    if (rows) out.push(...rows.map(toAnswerLite));
  }
  return out;
}

/**
 * Per-subject accuracy across every submitted attempt. Accuracy is correct ÷ answered (questions left
 * blank are reported separately), the same meaning it always had because blanks used to be unsaved.
 */
export async function getSubjectStats(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubjectStats[]> {
  const rows = await getAnswerRows(supabase, userId);
  const map = new Map<string, { total: number; correct: number; unanswered: number }>();
  for (const r of rows) {
    const entry = map.get(r.subject) ?? { total: 0, correct: 0, unanswered: 0 };
    if (r.answered) {
      entry.total += 1;
      if (r.correct) entry.correct += 1;
    } else {
      entry.unanswered += 1;
    }
    map.set(r.subject, entry);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.total > 0 || v.unanswered > 0)
    .map(([subjectName, { total, correct, unanswered }]) => ({
      subjectName,
      total,
      correct,
      unanswered,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    }));
}

/** Everything the Analytics page needs, fetched in one go. */
export async function getAnalyticsData(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ attempts: ExamAttempt[]; answers: AnswerLite[] }> {
  const [attempts, answers] = await Promise.all([getUserAttempts(supabase, userId, 300), getAnswerRows(supabase, userId)]);
  return { attempts, answers };
}

/**
 * Returns the last N submitted attempt scores (for the score-over-time chart).
 */
export async function getScoreHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 10,
): Promise<Array<{ score: number; question_count: number; submitted_at: string }>> {
  const attempts = await getUserAttempts(supabase, userId, limit);
  return attempts
    .filter((a) => a.submitted_at)
    .map((a) => ({ score: a.score, question_count: a.question_count, submitted_at: a.submitted_at as string }))
    .reverse();
}

/**
 * Returns questions the user got wrong, grouped ready for the mistakes page.
 */
export async function getWrongAnswers(
  supabase: SupabaseClient,
  userId: string,
  limit = 60,
): Promise<AttemptAnswer[]> {
  const local = await listLocalAttempts(userId);
  const localIds = new Set(local.map((a) => a.id));
  const deleted = await deletedAttemptIds(userId);
  const mine = local.flatMap((a) => localToAnswers(a).filter((r) => r.is_correct === false));
  if (!isOnline()) return mine.slice(0, limit);

  let remote: AttemptAnswer[] = [];
  try {
    remote = await getRemoteWrongAnswers(supabase, userId, limit + mine.length);
  } catch {
    remote = [];
  }
  return [...mine, ...remote.filter((r) => !localIds.has(r.attempt_id) && !deleted.has(r.attempt_id))].slice(0, limit);
}

async function getRemoteWrongAnswers(supabase: SupabaseClient, userId: string, limit: number): Promise<AttemptAnswer[]> {
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
  title: string | null;
  body: string;
  reply_count: number;
  is_pinned?: boolean;
  created_at: string;
  author?: { full_name: string; avatar_url?: string | null; user_code?: string | null };
  channel?: { name: string; slug: string };
  post_likes?: Array<{ user_id: string }> | number;
};

export type PostReply = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string; avatar_url?: string | null; user_code?: string | null };
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
  // post_likes embed gives both a count and the user_ids so the client can
  // highlight posts I liked. Soft-deleted posts are filtered out.
  let q = supabase
    .from("posts")
    .select("*, author:profiles(full_name, avatar_url, user_code), channel:channels(name,slug), post_likes(user_id)")
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data } = await q;
  return ((data ?? []) as unknown) as Post[];
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
    .select("*, author:profiles(full_name, avatar_url, user_code), channel:channels(name,slug), post_likes(user_id)")
    .eq("id", postId)
    .single();
  return data as Post | null;
}

export async function createPost(
  supabase: SupabaseClient,
  userId: string,
  channelId: string,
  title: string | null,
  body: string,
): Promise<Post | null> {
  const { data } = await supabase
    .from("posts")
    .insert({ user_id: userId, channel_id: channelId, title: title && title.trim() ? title.trim() : null, body })
    .select("*, author:profiles(full_name, avatar_url, user_code), channel:channels(name,slug), post_likes(user_id)")
    .single();
  return data as Post | null;
}

// Replies
export async function getReplies(supabase: SupabaseClient, postId: string): Promise<PostReply[]> {
  const { data } = await supabase
    .from("post_replies")
    .select("*, author:profiles(full_name, avatar_url, user_code)")
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
  // Primary path: also fetch each message's quoted reply (needs the
  // reply_to_id column — supabase/syllabus_promos_dm.sql).
  const primary = await supabase
    .from("direct_messages")
    .select("*, reply_to:direct_messages!reply_to_id(id, body, sender_id), sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  if (!primary.error) return (primary.data ?? []) as DirectMessage[];

  // Fallback: migration not applied yet — load the thread without reply data.
  const fallback = await supabase
    .from("direct_messages")
    .select("*, sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
    .order("created_at", { ascending: true });
  return (fallback.data ?? []) as DirectMessage[];
}

export async function sendDM(
  supabase: SupabaseClient,
  senderId: string,
  receiverId: string,
  body: string,
  replyToId?: string | null,
): Promise<DirectMessage | null> {
  // Primary path: store the reply reference + fetch its quoted message.
  // Requires the reply_to_id column (supabase/syllabus_promos_dm.sql).
  const primary = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, body, reply_to_id: replyToId ?? null })
    .select("*, reply_to:direct_messages!reply_to_id(id, body, sender_id), sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .single();
  if (!primary.error) return primary.data as DirectMessage | null;

  // Fallback: migration not applied yet — send without the reply reference
  // so normal messaging keeps working.
  const fallback = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, body })
    .select("*, sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url)")
    .single();
  return (fallback.data as DirectMessage | null) ?? null;
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
 * Current streak (consecutive Lagos days with at least one submitted attempt, ending today or yesterday).
 * Computed from attempt dates, so it is right even for attempts that only exist on this device.
 */
export function currentStreakFromDates(dates: string[], now: Date = new Date()): number {
  const days = new Set(dates.filter(Boolean).map((d) => lagosDate(d)));
  if (days.size === 0) return 0;
  let cursor = now;
  if (!days.has(lagosDate(cursor))) {
    cursor = new Date(cursor.getTime() - 86400000);
    if (!days.has(lagosDate(cursor))) return 0; // a day was missed
  }
  let streak = 0;
  while (days.has(lagosDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
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

// ─── Social: user codes, friends, follows, likes ───────────────────────────

export type SocialStats = { followers: number; following: number; friends: number };

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  requester?: { id: string; full_name: string; avatar_url?: string | null; user_code?: string | null };
  addressee?: { id: string; full_name: string; avatar_url?: string | null; user_code?: string | null };
};

/** Insert a notification row (RLS: authenticated users may notify others). */
export async function pushNotification(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({ user_id: userId, title, body });
  return !error;
}

/** Send (or re-send) a friend request. */
export async function sendFriendRequest(
  supabase: SupabaseClient,
  myId: string,
  targetId: string,
  myName: string,
): Promise<boolean> {
  if (myId === targetId) return false;
  const { error } = await supabase.from("friendships").insert({
    requester_id: myId,
    addressee_id: targetId,
    status: "pending",
  });
  if (error) return false; // duplicate request → unique constraint
  await pushNotification(supabase, targetId, "New friend request", `${myName} sent you a friend request.`);
  return true;
}

/** Accept a pending friend request addressed to me. */
export async function acceptFriendRequest(
  supabase: SupabaseClient,
  requestId: string,
  requesterId: string,
  myName: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("addressee_id", (await supabase.auth.getUser()).data.user?.id ?? "");
  if (error) return false;
  await pushNotification(supabase, requesterId, "Friend request accepted", `${myName} accepted your friend request. You are now friends!`);
  return true;
}

/** Remove a friendship row (either side, or reject a request). */
export async function removeFriendship(supabase: SupabaseClient, requestId: string): Promise<boolean> {
  const { error } = await supabase.from("friendships").delete().eq("id", requestId);
  return !error;
}

/**
 * All friendships involving me, joined with the OTHER person's profile.
 * Two embeds (requester/addressee) + client-side pick of the counterparty.
 */
export async function getMyFriendships(supabase: SupabaseClient, myId: string): Promise<Friendship[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*, requester:profiles!friendships_requester_id_fkey(id, full_name, avatar_url, user_code), addressee:profiles!friendships_addressee_id_fkey(id, full_name, avatar_url, user_code)")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .order("created_at", { ascending: false });
  if (error) return []; // migration not applied yet
  return (data ?? []) as Friendship[];
}

/** Follow (one-way). */
export async function followUser(supabase: SupabaseClient, myId: string, targetId: string): Promise<boolean> {
  if (myId === targetId) return false;
  const { error } = await supabase.from("follows").insert({ follower_id: myId, following_id: targetId });
  return !error;
}

export async function unfollowUser(supabase: SupabaseClient, myId: string, targetId: string): Promise<boolean> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", myId).eq("following_id", targetId);
  return !error;
}

/** Toggle a post like; returns true when the post is NOW liked. */
export async function togglePostLike(supabase: SupabaseClient, postId: string, myId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", myId)
    .maybeSingle();
  if (existing) {
    await supabase.from("post_likes").delete().eq("id", (existing as { id: string }).id);
    return false;
  }
  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: myId });
  return !error;
}

/** Social counters for a profile page (gracefully empty before migration). */
export async function getSocialStats(supabase: SupabaseClient, userId: string): Promise<SocialStats> {
  const { data, error } = await supabase.rpc("public_social_stats", { p_user: userId });
  if (error || !data || !(data as SocialStats[])[0]) return { followers: 0, following: 0, friends: 0 };
  const row = (data as SocialStats[])[0];
  return { followers: Number(row.followers), following: Number(row.following), friends: Number(row.friends) };
}

/** Find people by name OR user code (community search). */
export async function searchPeople(
  supabase: SupabaseClient,
  query: string,
  myId: string,
  limit = 12,
): Promise<Array<{ id: string; full_name: string; avatar_url: string | null; user_code: string | null; streak_days: number | null }>> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, user_code, streak_days")
    .or(`full_name.ilike.%${q}%,user_code.ilike.%${q}%`)
    .neq("id", myId)
    .limit(limit);
  if (error) return [];
  return (data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null; user_code: string | null; streak_days: number | null }>;
}

// ─── Admin: content moderation ──────────────────────────────────────────────

export async function adminDeletePost(supabase: SupabaseClient, postId: string): Promise<boolean> {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  return !error;
}

export async function adminSetPostPinned(supabase: SupabaseClient, postId: string, pinned: boolean): Promise<boolean> {
  const { error } = await supabase.from("posts").update({ is_pinned: pinned }).eq("id", postId);
  return !error;
}

export type ContentReport = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  reply_id: string | null;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
};

export async function getOpenReports(supabase: SupabaseClient): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from("content_reports")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as ContentReport[];
}

export async function resolveReport(supabase: SupabaseClient, reportId: string): Promise<boolean> {
  const { error } = await supabase.from("content_reports").update({ status: "resolved" }).eq("id", reportId);
  return !error;
}

export async function createContentReport(
  supabase: SupabaseClient,
  reporterId: string,
  opts: { postId?: string | null; replyId?: string | null; reason: string },
): Promise<boolean> {
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: reporterId,
    post_id: opts.postId ?? null,
    reply_id: opts.replyId ?? null,
    reason: opts.reason,
  });
  return !error;
}