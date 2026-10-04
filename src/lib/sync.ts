/**
 * Cloud backup / sync — runs ONLY on an explicit action (Settings → "Back up now", the "Back up" button on a
 * result, or right after the student signs in). Taking an exam never touches the network.
 *
 * What is pushed:
 *  • finished attempts that only exist on this device (with their original finish time),
 *  • attempt deletions made while offline,
 *  • bookmarks added/removed on this device; bookmarks saved from another device are pulled down.
 * Then the streak is recomputed and achievements are evaluated once, from the full history.
 *
 * Attempt ids are generated on the device and reused as the cloud row id, so running a sync twice (or after a
 * dropped connection halfway) never creates duplicates.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMeta,
  listAllLocalBookmarks,
  listLocalAttempts,
  markAttemptSynced,
  purgeLocalBookmark,
  putLocalBookmarkRaw,
  setMeta,
  type LocalAttempt,
  type LocalBookmark,
} from "./localDb";
import {
  currentStreakFromDates,
  describeSaveError,
  getProfile,
  saveAnswers,
  submitAttempt,
  updateProfile,
  type QuestionSnapshot,
} from "./queries";

export type SyncResult = {
  ok: boolean;
  /** Attempts newly backed up */
  attempts: number;
  /** Attempts that could not be backed up (they stay safe on the device) */
  failedAttempts: number;
  bookmarksPushed: number;
  bookmarksPulled: number;
  /** Plain-language reason when something did not go through */
  message: string | null;
  at: string;
};

let inFlight: Promise<SyncResult> | null = null;

export const LAST_SYNC_META = (userId: string) => `lastSyncAt:${userId}`;

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function pushAttempt(supabase: SupabaseClient, userId: string, a: LocalAttempt): Promise<void> {
  // 1. the attempt row, with the id and start time chosen on the device (idempotent on retry)
  const { error: headerError } = await supabase.from("exam_attempts").upsert(
    {
      id: a.id,
      user_id: userId,
      subject_id: null,
      question_count: a.questionCount,
      started_at: a.startedAt,
    },
    { onConflict: "id" },
  );
  if (headerError) throw new Error(describeSaveError(headerError));

  // 2. every question (blank ones too), then 3. the score with the ORIGINAL finish time
  await saveAnswers(supabase, a.id, a.answers);
  await submitAttempt(supabase, a.id, a.score, a.submittedAt);
}

type BookmarkRow = {
  user_id: string;
  question_id: string;
  subject: string | null;
  question_data: QuestionSnapshot;
  created_at: string;
};

/** Bookmarks: push local changes, pull what other devices saved. A missing table is not an error. */
async function syncBookmarks(supabase: SupabaseClient, userId: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0;
  let pulled = 0;
  const local = await listAllLocalBookmarks(userId);

  const removed = local.filter((b) => b.deleted);
  for (const b of removed) {
    const { error } = await supabase.from("question_bookmarks").delete().eq("user_id", userId).eq("question_id", b.questionId);
    if (error) {
      if (isMissingTable(error)) return { pushed, pulled };
      continue;
    }
    await purgeLocalBookmark(b.key);
    pushed += 1;
  }

  const added = local.filter((b) => !b.deleted && !b.syncedAt);
  if (added.length > 0) {
    const rows: BookmarkRow[] = added.map((b) => ({
      user_id: userId,
      question_id: b.questionId,
      subject: b.subject,
      question_data: b.question,
      created_at: b.createdAt,
    }));
    const { error } = await supabase.from("question_bookmarks").upsert(rows, { onConflict: "user_id,question_id" });
    if (error) {
      if (isMissingTable(error)) return { pushed, pulled };
      throw new Error(describeSaveError(error));
    }
    const now = new Date().toISOString();
    for (const b of added) await putLocalBookmarkRaw({ ...b, syncedAt: now });
    pushed += added.length;
  }

  const { data, error } = await supabase
    .from("question_bookmarks")
    .select("question_id, subject, question_data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (!error && data) {
    const have = new Map(local.map((b) => [b.questionId, b]));
    const now = new Date().toISOString();
    for (const row of data as Array<Pick<BookmarkRow, "question_id" | "subject" | "question_data" | "created_at">>) {
      if (have.has(row.question_id)) continue; // device copy (or a pending deletion) wins
      const entry: LocalBookmark = {
        key: `${userId}:${row.question_id}`,
        userId,
        questionId: row.question_id,
        question: row.question_data,
        subject: row.subject ?? row.question_data?.subject_name ?? "Unknown",
        createdAt: row.created_at,
        deleted: false,
        syncedAt: now,
      };
      await putLocalBookmarkRaw(entry);
      pulled += 1;
    }
  }
  return { pushed, pulled };
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|not find the table/i.test(error.message ?? "");
}

async function runSync(supabase: SupabaseClient, userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    ok: true,
    attempts: 0,
    failedAttempts: 0,
    bookmarksPushed: 0,
    bookmarksPulled: 0,
    message: null,
    at: new Date().toISOString(),
  };

  if (isOffline()) {
    return { ...result, ok: false, message: "You're offline. Your progress is safe on this device and will back up when you sync with a connection." };
  }

  const problems: string[] = [];

  // ── attempts ──
  const pending = (await listLocalAttempts(userId)).filter((a) => !a.syncedAt).reverse(); // oldest first
  for (const attempt of pending) {
    try {
      await pushAttempt(supabase, userId, attempt);
      await markAttemptSynced(attempt.id);
      result.attempts += 1;
    } catch (err) {
      result.failedAttempts += 1;
      problems.push(err instanceof Error ? err.message : describeSaveError(err));
    }
  }

  // ── deletions made while offline ──
  try {
    const key = `deletedAttempts:${userId}`;
    const ids = (await getMeta<string[]>(key)) ?? [];
    const left: string[] = [];
    for (const id of ids) {
      const { error } = await supabase.from("exam_attempts").delete().eq("id", id);
      if (error) left.push(id);
    }
    if (ids.length > 0) await setMeta(key, left);
  } catch (err) {
    problems.push(describeSaveError(err));
  }

  // ── bookmarks ──
  try {
    const b = await syncBookmarks(supabase, userId);
    result.bookmarksPushed = b.pushed;
    result.bookmarksPulled = b.pulled;
  } catch (err) {
    problems.push(describeSaveError(err));
  }

  // ── streak + achievements, once, from the full history ──
  if (result.attempts > 0) {
    try {
      const all = await listLocalAttempts(userId);
      const computed = currentStreakFromDates(all.map((a) => a.submittedAt));
      const profile = await getProfile(supabase, userId);
      if (profile && computed > (profile.streak_days ?? 0)) await updateProfile(supabase, userId, { streak_days: computed });
    } catch {
      /* streaks are optional */
    }
    try {
      const { data: session } = await supabase.auth.getSession();
      await fetch("/api/achievements/evaluate", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
      });
    } catch {
      /* achievements are optional */
    }
  }

  if (problems.length > 0) {
    result.ok = false;
    result.message = friendlyProblem(problems[0]);
  } else {
    await setMeta(LAST_SYNC_META(userId), result.at);
  }
  return result;
}

function friendlyProblem(raw: string): string {
  if (/failed to fetch|networkerror|network request|load failed|offline/i.test(raw)) {
    return "The connection dropped. Nothing was lost — try again when you have a signal.";
  }
  return `Some items could not be backed up yet (${raw}). They are safe on this device.`;
}

/** Back up everything pending. Calls made while a sync is running share that run. */
export function syncToCloud(supabase: SupabaseClient, userId: string): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = runSync(supabase, userId)
    .catch((err): SyncResult => ({
      ok: false,
      attempts: 0,
      failedAttempts: 0,
      bookmarksPushed: 0,
      bookmarksPulled: 0,
      message: friendlyProblem(err instanceof Error ? err.message : String(err)),
      at: new Date().toISOString(),
    }))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
