"use client";

/**
 * Background top-up: whenever a student is online (app opened, or data/Wi-Fi switched back on) the device's saved
 * question pool for their subjects is refreshed. Each request also makes the server save the questions into the
 * database (question bank), so the cloud copy and the phone copy grow together without the student doing anything.
 *
 * Polite by design: at most once every 6 hours, one subject at a time, skipped on Data Saver / very slow
 * connections, and any failure is silent (the exam page still fetches on demand).
 */
import { cacheKey } from "./questionCache";
import { getMeta, setMeta } from "./localDb";
import { addToPool } from "./questionPool";

export const QSYNC_EVERY_MS = 6 * 60 * 60 * 1000;
const BATCH = 100;
const MAX_SUBJECTS = 5;
const META = "questionSync:last";
let running = false;
const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

type Conn = { saveData?: boolean; effectiveType?: string };

/** True when a background download would be unwelcome (Data Saver on, or 2G). */
export function connectionIsPoor(c: Conn | undefined | null): boolean {
  if (!c) return false;
  return c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

/** Subjects to keep fresh: English plus the student's chosen subjects (de-duplicated, capped). */
export function subjectsToSync(interests: string[] | null | undefined): string[] {
  const list = ["English Language", ...(interests ?? [])]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true))).slice(0, MAX_SUBJECTS);
}

export type QuestionSyncResult = { ran: boolean; subjects: number; added: number };

export async function syncQuestionsInBackground(
  interests: string[] | null | undefined,
  opts: { force?: boolean } = {},
): Promise<QuestionSyncResult> {
  const none = { ran: false, subjects: 0, added: 0 };
  if (running || !isOnline()) return none;
  if (!opts.force && connectionIsPoor((navigator as Navigator & { connection?: Conn }).connection)) return none;

  const last = await getMeta<number>(META);
  if (!opts.force && typeof last === "number" && Date.now() - last < QSYNC_EVERY_MS) return none;

  running = true;
  let subjects = 0;
  let added = 0;
  try {
    for (const subject of subjectsToSync(interests)) {
      if (!isOnline()) break;
      try {
        const res = (await fetch(
          `/api/aloc?endpoint=questions&subject=${encodeURIComponent(subject)}&type=utme&count=${BATCH}&spread=1&t=${Date.now()}`,
        ).then((r) => r.json())) as { ok: boolean; data?: { id: string | number }[] };
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          await addToPool(cacheKey(subject), res.data);
          subjects++;
          added += res.data.length;
        }
      } catch {
        /* try the next subject */
      }
      await new Promise((r) => setTimeout(r, 1500)); // gentle on the ALOC rate limit
    }
    if (subjects > 0) await setMeta(META, Date.now());
  } finally {
    running = false;
  }
  return { ran: true, subjects, added };
}
