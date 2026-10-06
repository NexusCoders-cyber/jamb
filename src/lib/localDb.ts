/**
 * Offline-first device storage (browser only).
 *
 * Everything a student does in an exam is stored HERE first — attempts, the unfinished session, bookmarks and
 * small bookkeeping values — in IndexedDB, so the app works with no network and nothing is lost when the
 * connection drops. The cloud (Supabase) is only written to when the student asks for it (see lib/sync.ts).
 *
 * This is a separate database from the question cache (lib/questionCache.ts) so the two can be versioned
 * independently. If IndexedDB is unavailable (some private modes) an in-memory store keeps the app working for
 * the current visit; `storageMode()` tells the UI whether data will survive a restart.
 *
 * Stores:  attempts · sessions · bookmarks · meta
 */
import type { QuestionSnapshot } from "./queries";

const DB_NAME = "qubit_local";
const DB_VERSION = 1;

type StoreName = "attempts" | "sessions" | "bookmarks" | "meta";
const STORES: Record<StoreName, string> = {
  attempts: "id",
  sessions: "id",
  bookmarks: "key",
  meta: "key",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type LocalAnswerRow = {
  question_id: string;
  /** null = left unanswered */
  selected_option: number | null;
  is_correct: boolean | null;
  marked_for_review: boolean;
  question?: QuestionSnapshot;
};

/** A finished exam/practice attempt. The id is generated on the device and reused as the cloud id on sync. */
export type LocalAttempt = {
  id: string;
  userId: string;
  questionCount: number;
  score: number;
  startedAt: string;
  submittedAt: string;
  label: string;
  mode: string;
  answers: LocalAnswerRow[];
  /** ISO time it was backed up to the cloud; null = only on this device */
  syncedAt: string | null;
};

/** An exam in progress (one per user and mode) so a closed tab, dead battery or lost signal can be resumed. */
export type LocalSession = {
  id: string; // `${userId}:${mode}`
  userId: string;
  mode: string;
  /** Serializable exam state, owned by the exam page */
  state: unknown;
  savedAt: string;
};

export type LocalBookmark = {
  /** `${userId}:${questionId}` */
  key: string;
  userId: string;
  questionId: string;
  question: QuestionSnapshot;
  subject: string;
  createdAt: string;
  /** true = removed on this device but the removal has not reached the cloud yet */
  deleted: boolean;
  syncedAt: string | null;
};

type MetaRow = { key: string; value: unknown };

// ─── Environment ─────────────────────────────────────────────────────────────

const isBrowser = typeof window !== "undefined";

let dbPromise: Promise<IDBDatabase | null> | null = null;
let mode: "indexeddb" | "memory" = "indexeddb";
const memory: Record<StoreName, Map<string, unknown>> = {
  attempts: new Map(),
  sessions: new Map(),
  bookmarks: new Map(),
  meta: new Map(),
};

/** "indexeddb" = data survives restarts; "memory" = only for this visit (IndexedDB unavailable). */
export function storageMode(): "indexeddb" | "memory" {
  return mode;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser || typeof indexedDB === "undefined") {
    mode = "memory";
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab upgraded the schema or the browser is reclaiming storage: reopen next time
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        mode = "memory";
        dbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        mode = "memory";
        resolve(null);
      };
    } catch {
      mode = "memory";
      resolve(null);
    }
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  if (!isBrowser) return [];
  const db = await openDb();
  if (!db) return Array.from(memory[store].values()) as T[];
  try {
    return (await wrap(db.transaction(store, "readonly").objectStore(store).getAll())) as T[];
  } catch {
    return Array.from(memory[store].values()) as T[];
  }
}

async function getOne<T>(store: StoreName, key: string): Promise<T | undefined> {
  if (!isBrowser) return undefined;
  const db = await openDb();
  if (!db) return memory[store].get(key) as T | undefined;
  try {
    return (await wrap(db.transaction(store, "readonly").objectStore(store).get(key))) as T | undefined;
  } catch {
    return memory[store].get(key) as T | undefined;
  }
}

async function putOne(store: StoreName, value: unknown): Promise<boolean> {
  if (!isBrowser) return false;
  const keyPath = STORES[store];
  const key = String((value as Record<string, unknown>)[keyPath]);
  const db = await openDb();
  if (!db) {
    memory[store].set(key, value);
    emitChange();
    return true;
  }
  try {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
    });
    emitChange();
    return true;
  } catch (err) {
    // Quota exceeded etc.: keep it for this visit so the student does not lose the attempt they just finished
    console.warn("Local save to IndexedDB failed, keeping in memory:", err);
    memory[store].set(key, value);
    mode = "memory";
    emitChange();
    return true;
  }
}

async function deleteOne(store: StoreName, key: string): Promise<void> {
  if (!isBrowser) return;
  memory[store].delete(key);
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }
  emitChange();
}

// ─── Change notifications (lets pages/hooks refresh when local data changes) ─

const listeners = new Set<() => void>();
export function subscribeLocal(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emitChange() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a broken listener must not break storage */
    }
  }
}

// ─── Ids ─────────────────────────────────────────────────────────────────────

/** RFC 4122 v4 id. Also valid as a Postgres uuid, so it can be reused as the cloud row id on sync. */
export function newId(): string {
  const c = isBrowser ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ─── Attempts ────────────────────────────────────────────────────────────────

export async function saveLocalAttempt(attempt: LocalAttempt): Promise<void> {
  await putOne("attempts", attempt);
}

export async function getLocalAttempt(id: string): Promise<LocalAttempt | null> {
  return (await getOne<LocalAttempt>("attempts", id)) ?? null;
}

/** Newest first. */
export async function listLocalAttempts(userId: string): Promise<LocalAttempt[]> {
  const all = await getAll<LocalAttempt>("attempts");
  return all.filter((a) => a.userId === userId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function deleteLocalAttempt(id: string): Promise<void> {
  await deleteOne("attempts", id);
}

export async function markAttemptSynced(id: string, when = new Date().toISOString()): Promise<void> {
  const current = await getLocalAttempt(id);
  if (current) await putOne("attempts", { ...current, syncedAt: when });
}

// ─── In-progress session ─────────────────────────────────────────────────────

function sessionId(userId: string, mode: string): string {
  return `${userId}:${mode}`;
}

export async function saveLocalSession(userId: string, mode: string, state: unknown): Promise<void> {
  const row: LocalSession = { id: sessionId(userId, mode), userId, mode, state, savedAt: new Date().toISOString() };
  await putOne("sessions", row);
}

export async function getLocalSession(userId: string, mode: string): Promise<LocalSession | null> {
  return (await getOne<LocalSession>("sessions", sessionId(userId, mode))) ?? null;
}

export async function clearLocalSession(userId: string, mode: string): Promise<void> {
  await deleteOne("sessions", sessionId(userId, mode));
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export function bookmarkKey(userId: string, questionId: string): string {
  return `${userId}:${questionId}`;
}

export async function setLocalBookmark(
  userId: string,
  question: QuestionSnapshot,
  subject: string,
): Promise<LocalBookmark> {
  const existing = await getOne<LocalBookmark>("bookmarks", bookmarkKey(userId, question.id));
  const row: LocalBookmark = {
    key: bookmarkKey(userId, question.id),
    userId,
    questionId: question.id,
    question,
    subject,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    deleted: false,
    syncedAt: null,
  };
  await putOne("bookmarks", row);
  return row;
}

/** Removes a bookmark. One that already reached the cloud is kept as a tombstone until the next sync. */
export async function removeLocalBookmark(userId: string, questionId: string): Promise<void> {
  const key = bookmarkKey(userId, questionId);
  const existing = await getOne<LocalBookmark>("bookmarks", key);
  if (!existing) return;
  if (existing.syncedAt) await putOne("bookmarks", { ...existing, deleted: true, syncedAt: null });
  else await deleteOne("bookmarks", key);
}

export async function isLocalBookmarked(userId: string, questionId: string): Promise<boolean> {
  const row = await getOne<LocalBookmark>("bookmarks", bookmarkKey(userId, questionId));
  return !!row && !row.deleted;
}

/** Visible bookmarks, newest first. */
export async function listLocalBookmarks(userId: string): Promise<LocalBookmark[]> {
  const all = await getAll<LocalBookmark>("bookmarks");
  return all.filter((b) => b.userId === userId && !b.deleted).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Everything including tombstones — for sync only. */
export async function listAllLocalBookmarks(userId: string): Promise<LocalBookmark[]> {
  const all = await getAll<LocalBookmark>("bookmarks");
  return all.filter((b) => b.userId === userId);
}

export async function putLocalBookmarkRaw(row: LocalBookmark): Promise<void> {
  await putOne("bookmarks", row);
}

export async function purgeLocalBookmark(key: string): Promise<void> {
  await deleteOne("bookmarks", key);
}

// ─── Meta (small values) ─────────────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await getOne<MetaRow>("meta", key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await putOne("meta", { key, value } satisfies MetaRow);
}

// ─── Pending-work summary (drives the "Back up now" UI) ──────────────────────

export type PendingSummary = { attempts: number; bookmarks: number; deletions: number; total: number };

export async function getPendingSummary(userId: string): Promise<PendingSummary> {
  const [attempts, bookmarks, deleted] = await Promise.all([
    listLocalAttempts(userId),
    listAllLocalBookmarks(userId),
    getMeta<string[]>(`deletedAttempts:${userId}`),
  ]);
  const a = attempts.filter((x) => !x.syncedAt).length;
  const b = bookmarks.filter((x) => !x.syncedAt).length;
  const d = deleted?.length ?? 0;
  return { attempts: a, bookmarks: b, deletions: d, total: a + b + d };
}

// ─── Wipe (account deletion) ─────────────────────────────────────────────────

/** Remove everything this device holds for one student: results, unfinished exams, bookmarks and sync markers. */
export async function clearUserLocalData(userId: string): Promise<void> {
  for (const a of await getAll<LocalAttempt>("attempts")) if (a.userId === userId) await deleteOne("attempts", a.id);
  for (const s of await getAll<LocalSession>("sessions")) if (s.userId === userId) await deleteOne("sessions", s.id);
  for (const b of await getAll<LocalBookmark>("bookmarks")) if (b.userId === userId) await deleteOne("bookmarks", b.key);
  for (const m of await getAll<{ key: string }>("meta")) if (m.key.includes(userId)) await deleteOne("meta", m.key);
}
