/**
 * Server-side question bank (table public.question_bank, see supabase/question_bank.sql).
 *
 *  - saveToBank():    every NEW question ALOC returns is stored; ones already stored are skipped, never rewritten.
 *  - sampleFromBank(): a random sample, used when ALOC is down / out of credits so students are never stranded.
 *  - serveFromBank():  BANK FIRST — once the bank holds enough questions for a subject (or subject + year), students
 *                      are served from it directly and ALOC is not called at all. Filled by scripts/fill-bank.ts.
 *
 * Everything FAILS OPEN: if the table isn't created yet or Supabase hiccups, the app behaves exactly as before.
 */
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import type { NormalizedQuestion } from "@/lib/aloc";

let cached: SupabaseClient | null = null;
function adminClient(): SupabaseClient | null {
  try {
    if (!cached) {
      const { url, serviceRoleKey } = getSupabaseAdminEnv();
      cached = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    }
    return cached;
  } catch {
    return null; // env vars missing (local dev / build)
  }
}

export const normSubject = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const normText = (s: string) => s.toLowerCase().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Same question reused under another ALOC id → same key. */
export function bankKey(subject: string, q: Pick<NormalizedQuestion, "prompt" | "options">): string {
  const body = normText(q.prompt) + "|" + q.options.map(normText).join("|");
  return `${normSubject(subject)}:${createHash("sha1").update(body).digest("hex").slice(0, 20)}`;
}

function worthKeeping(q: NormalizedQuestion): boolean {
  return (
    (q.source ?? "aloc") === "aloc" && // the app's own set-text dataset needs no copy
    typeof q.prompt === "string" && q.prompt.trim().length > 3 &&
    Array.isArray(q.options) && q.options.length >= 2 &&
    Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length
  );
}

const hasPictures = (q: NormalizedQuestion) =>
  Boolean(q.image || q.images?.length || q.optionImages?.some(Boolean) || q.sectionImages?.length);

export type SaveResult = {
  /** Questions that were NEW and are now stored */
  added: number;
  /** Questions the bank already had — left exactly as they were (nothing is written for them) */
  existing: number;
  /** false when the database could not be reached or the table is missing */
  ok: boolean;
};

/**
 * Store only the questions the bank does not have yet.
 *
 * A question already in the bank (same subject + same text + same options) is NEVER written again:
 * the insert uses ON CONFLICT DO NOTHING, so repeats cost no storage and leave no rewritten leftovers
 * behind in the table. Before this, every repeat was rewritten on every save, which wastes database space.
 */
export async function saveNewToBank(subject: string, questions: NormalizedQuestion[]): Promise<SaveResult> {
  const none: SaveResult = { added: 0, existing: 0, ok: false };
  try {
    const db = adminClient();
    if (!db || !subject) return none;
    const seen = new Set<string>();
    const rows = questions.filter(worthKeeping).flatMap((q) => {
      const key = bankKey(subject, q);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        key,
        subject: normSubject(subject),
        year: q.year ? String(q.year) : null,
        exam_type: q.examtype ?? null,
        has_images: hasPictures(q),
        data: q,
      }];
    });
    if (rows.length === 0) return { added: 0, existing: 0, ok: true };
    let added = 0;
    let existing = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      // .select("key") makes the database return only the rows it actually inserted
      const { data, error } = await db
        .from("question_bank")
        .upsert(chunk, { onConflict: "key", ignoreDuplicates: true })
        .select("key");
      if (error) {
        console.warn("[question-bank] save skipped:", error.message);
        return { added, existing, ok: false }; // table missing or database trouble — stop quietly
      }
      const inserted = Array.isArray(data) ? data.length : 0;
      added += inserted;
      existing += chunk.length - inserted;
    }
    return { added, existing, ok: true };
  } catch (err) {
    console.warn("[question-bank] save failed:", err instanceof Error ? err.message : err);
    return none;
  }
}

/** Same as saveNewToBank, returning only how many NEW questions were stored (0 when none / unavailable). */
export async function saveToBank(subject: string, questions: NormalizedQuestion[]): Promise<number> {
  return (await saveNewToBank(subject, questions)).added;
}

/** A random sample for a subject (and optionally one exam year). Empty when the bank has nothing / is unavailable. */
export async function sampleFromBank(subject: string, year: string | null, count: number): Promise<NormalizedQuestion[]> {
  try {
    const db = adminClient();
    if (!db) return [];
    const { data, error } = await db.rpc("question_bank_sample", {
      p_subject: subject,
      p_year: year,
      p_count: Math.max(1, Math.min(400, Math.floor(count))),
    });
    if (error || !Array.isArray(data)) return [];
    return (data as NormalizedQuestion[]).filter((q) => q && typeof q.prompt === "string");
  } catch {
    return [];
  }
}

export async function bankStats(): Promise<{ subject: string; total: number; withImages: number }[] | null> {
  try {
    const db = adminClient();
    if (!db) return null;
    const { data, error } = await db.rpc("question_bank_stats");
    if (error || !Array.isArray(data)) return null;
    return (data as { subject: string; total: number | string; with_images: number | string }[]).map((r) => ({
      subject: r.subject,
      total: Number(r.total),
      withImages: Number(r.with_images),
    }));
  } catch {
    return null;
  }
}

// ─── Bank first ──────────────────────────────────────────────────────────────
// The bank is the main source once it is full enough; ALOC is only asked when the bank is thin (and what ALOC
// returns is saved, so the bank keeps growing). Turn it off with QUESTION_SOURCE=live.

/** A named exam year is served from the bank once it holds this many questions (a JAMB paper has 40 per subject). */
export const BANK_YEAR_SET_SIZE = 40;
/** "Random mix — all years" is served from the bank once a subject holds at least this many questions. */
export const BANK_MIN_ANY_YEAR = 150;

/** QUESTION_SOURCE=live switches bank-first off (students always get fresh ALOC questions, as before). */
export function bankFirstEnabled(): boolean {
  return (process.env.QUESTION_SOURCE ?? "").trim().toLowerCase() !== "live";
}

/**
 * English is never served from the bank yet: its comprehension / cloze questions only make sense grouped with
 * their passage (see lib/englishPaper.ts), and a random sample would split them up.
 */
export function isEnglishSubject(subject: string): boolean {
  return /^(english|english language|use of english)$/.test(normSubject(subject));
}

/**
 * Pure decision (no I/O, so it is easy to test): given how many questions the bank holds, should this request be
 * answered from the bank, and how many questions must come back for that answer to count?
 */
export function bankServePlan(input: {
  subject: string;
  /** null = random mix of all years */
  year: string | null;
  want: number;
  bankSize: number;
}): { serve: boolean; minReturn: number } {
  const want = Math.min(200, Math.max(1, Math.floor(input.want) || 1));
  if (isEnglishSubject(input.subject)) return { serve: false, minReturn: want };
  if (input.year) {
    // One exam year only has about a paper's worth of questions, so never ask for more than that to be present
    const need = Math.min(want, BANK_YEAR_SET_SIZE);
    return { serve: input.bankSize >= need, minReturn: Math.ceil(need * 0.9) };
  }
  // Random mix: wait until the pool is comfortably bigger than the request so sessions don't repeat
  return { serve: input.bankSize >= Math.max(BANK_MIN_ANY_YEAR, want * 2), minReturn: Math.ceil(want * 0.9) };
}

const COUNT_TTL_MS = 5 * 60 * 1000;
const countCache = new Map<string, { at: number; n: number }>();

/** How many questions the bank holds for a subject (and optionally one year). 0 when unavailable. Cached for 5 minutes. */
export async function bankCount(subject: string, year: string | null): Promise<number> {
  try {
    const cacheKey = `${normSubject(subject)}|${year ?? ""}`;
    const hit = countCache.get(cacheKey);
    if (hit && Date.now() - hit.at < COUNT_TTL_MS) return hit.n;
    const db = adminClient();
    if (!db) return 0;
    let q = db.from("question_bank").select("key", { count: "exact", head: true }).eq("subject", normSubject(subject));
    if (year) q = q.eq("year", year);
    const { count, error } = await q;
    if (error || typeof count !== "number") return 0; // not cached, so a recovered database is noticed straight away
    countCache.set(cacheKey, { at: Date.now(), n: count });
    return count;
  } catch {
    return 0;
  }
}

/**
 * BANK FIRST. Returns a random set from the bank when it is full enough for this request, or null — meaning
 * "ask ALOC as before". Never throws: any database problem simply means null.
 */
export async function serveFromBank(subject: string, year: string | null, want: number): Promise<NormalizedQuestion[] | null> {
  try {
    if (!bankFirstEnabled() || !subject || isEnglishSubject(subject)) return null;
    const bankSize = await bankCount(subject, year);
    const plan = bankServePlan({ subject, year, want, bankSize });
    if (!plan.serve) return null;
    const list = await sampleFromBank(subject, year, want);
    return list.length >= plan.minReturn ? list : null;
  } catch {
    return null;
  }
}
