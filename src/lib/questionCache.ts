"use client";

/**
 * IndexedDB-backed question cache.
 *
 * Questions fetched from ALOC are stored locally so they are available
 * offline and load instantly on subsequent visits — like a native app.
 *
 * API:
 *   getCachedQuestions(key)      — returns cached array or null
 *   setCachedQuestions(key, qs)  — stores with a 24-hour TTL
 *   clearQuestionCache()         — wipes everything (call on sign-out if needed)
 *
 * Key format: "subject:year" or just "subject" for all-years.
 * E.g. "Mathematics:2023", "English Language:all"
 */

const DB_NAME = "orbitprep";
const STORE   = "questions";
const VERSION = 1;
const TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

type CacheEntry = {
  key: string;
  data: unknown[];
  storedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function getCachedQuestions<T = unknown>(key: string, opts: { allowStale?: boolean } = {}): Promise<T[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) { resolve(null); return; }
        if (!opts.allowStale && Date.now() - entry.storedAt > TTL_MS) {
          // Expired — delete silently and return null
          db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
          resolve(null);
          return;
        }
        resolve(entry.data as T[]);
      };
      req.onerror = () => resolve(null);
    });
  } catch (_e) {
    return null;
  }
}

export async function setCachedQuestions<T = unknown>(key: string, data: T[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE, "readwrite");
      const entry: CacheEntry = { key, data, storedAt: Date.now() };
      const req   = tx.objectStore(STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  } catch (_e) {
    // Fail silently — cache is a performance optimisation, not required
  }
}

export async function clearQuestionCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => resolve();
    });
  } catch (_e) {
    // Ignore
  }
}

/**
 * Bump when the shape/quality of cached questions changes, so devices holding old (truncated or
 * badly parsed) question sets stop serving them and fetch fresh, fully hydrated ones.
 */
export const QUESTION_CACHE_VERSION = "v2";

/** Build a consistent cache key from subject + optional year. */
export function cacheKey(subject: string, year?: string): string {
  return `${QUESTION_CACHE_VERSION}:${subject.toLowerCase().trim()}:${year?.toLowerCase().trim() || "all"}`;
}
