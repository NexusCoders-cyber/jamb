"use client";

/**
 * Builds the question pool for a session so that every new session is DIFFERENT.
 *
 *  1. Ask the server for a fresh batch (online). The batch is merged into the device's saved pool for that
 *     subject/year, so the pool grows with use and still works offline.
 *  2. Order the pool: questions the student has never been given come first (shuffled), then the ones seen
 *     longest ago. The caller takes what it needs from the front.
 *  3. After the session's questions are chosen, `markQuestionsSeen` remembers them.
 *
 * The old behaviour — reuse the saved copy of the first batch for 24 hours — gave the same questions every time.
 */
import { getCachedQuestions, setCachedQuestions } from "./questionCache";
import { getMeta, setMeta } from "./localDb";

type WithId = { id: string | number };

const MAX_POOL = 400;
const MAX_SEEN = 3000;

function seenKey(subject: string): string {
  return `seen:${subject.toLowerCase().trim()}`;
}

function shuffle<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Same question under a different id (ALOC reuses questions across papers): compare by prompt text too. */
function textKey(q: unknown): string {
  const p = (q as { prompt?: unknown }).prompt;
  return typeof p === "string" ? p.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

function mergeUnique<T extends WithId>(...lists: T[][]): T[] {
  const ids = new Set<string>();
  const texts = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const q of list) {
      const id = String(q.id);
      const t = textKey(q);
      if (ids.has(id) || (t && texts.has(t))) continue;
      ids.add(id);
      if (t) texts.add(t);
      out.push(q);
    }
  }
  return out;
}

/** Add a downloaded batch to the pool kept on the device (used by "Download for offline"). Returns the pool size. */
export async function addToPool<T extends WithId>(cacheKey: string, batch: T[]): Promise<number> {
  const current = (await getCachedQuestions<T>(cacheKey, { allowStale: true })) ?? [];
  const merged = mergeUnique(batch, current).slice(0, MAX_POOL);
  await setCachedQuestions(cacheKey, merged);
  return merged.length;
}

export async function loadSeen(subject: string): Promise<Record<string, number>> {
  return (await getMeta<Record<string, number>>(seenKey(subject))) ?? {};
}

/** Remember which questions were given, so the next sessions prefer ones the student has not met. */
export async function markQuestionsSeen(subject: string, ids: (string | number)[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const seen = await loadSeen(subject);
    const now = Date.now();
    ids.forEach((id, i) => {
      seen[String(id)] = now + i;
    });
    const entries = Object.entries(seen);
    if (entries.length > MAX_SEEN) {
      entries.sort((a, b) => b[1] - a[1]);
      await setMeta(seenKey(subject), Object.fromEntries(entries.slice(0, MAX_SEEN)));
    } else {
      await setMeta(seenKey(subject), seen);
    }
  } catch {
    /* remembering is a nicety; never block a session */
  }
}

/**
 * @returns the pool ordered "never seen first (random), then least recently seen". Throws the fetch error
 * only when there is nothing on the device either.
 */
export async function buildSessionPool<T extends WithId>(opts: {
  subject: string;
  cacheKey: string;
  fetchBatch: () => Promise<T[]>;
}): Promise<T[]> {
  const stored = (await getCachedQuestions<T>(opts.cacheKey, { allowStale: true })) ?? [];

  let fresh: T[] = [];
  let fetchError: unknown = null;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      fresh = await opts.fetchBatch();
    } catch (err) {
      fetchError = err;
    }
  }

  const pool = mergeUnique(fresh, stored).slice(0, MAX_POOL);
  if (pool.length === 0) {
    throw fetchError instanceof Error ? fetchError : new Error("No questions available yet. Connect once to download some.");
  }
  if (fresh.length > 0) void setCachedQuestions(opts.cacheKey, pool);

  // Grow the device pool in the background (one more batch a few seconds after the session starts),
  // so even if the server tends to repeat itself the next session has more to choose from.
  if (fresh.length > 0 && typeof window !== "undefined") {
    window.setTimeout(() => {
      void (async () => {
        try {
          const more = await opts.fetchBatch();
          const current = (await getCachedQuestions<T>(opts.cacheKey, { allowStale: true })) ?? pool;
          await setCachedQuestions(opts.cacheKey, mergeUnique(more, current).slice(0, MAX_POOL));
        } catch {
          /* background top-up only */
        }
      })();
    }, 4000);
  }

  const seen = await loadSeen(opts.subject);
  const unseen = shuffle(pool.filter((q) => seen[String(q.id)] === undefined));
  const met = pool.filter((q) => seen[String(q.id)] !== undefined).sort((a, b) => seen[String(a.id)] - seen[String(b.id)]);
  // Questions from the fresh batch that were already met are no better than the older ones: oldest-seen first
  return [...unseen, ...met];
}
