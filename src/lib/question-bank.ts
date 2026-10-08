/**
 * Server-side question bank (table public.question_bank, see supabase/question_bank.sql).
 *
 *  - saveToBank():    every question ALOC returns is stored, de-duplicated by its text + options.
 *  - sampleFromBank(): a random sample, used when ALOC is down / out of credits so students are never stranded.
 *
 * Everything FAILS OPEN: if the table isn't created yet or Supabase hiccups, the app behaves exactly as before.
 */
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminEnv } from "@/lib/env";
import { nameToSlug, slugToName, type NormalizedQuestion } from "@/lib/aloc";

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

/** One canonical spelling per subject ("english", "English" and "English Language" all become "english language"). */
export const normSubject = (s: string) => slugToName(nameToSlug(s)).toLowerCase().replace(/\s+/g, " ").trim();
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

/** @returns how many rows were written (0 when the bank isn't available). */
export async function saveToBank(subject: string, questions: NormalizedQuestion[]): Promise<number> {
  try {
    const db = adminClient();
    if (!db || !subject) return 0;
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
        updated_at: new Date().toISOString(),
      }];
    });
    let written = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await db.from("question_bank").upsert(rows.slice(i, i + 100), { onConflict: "key" });
      if (error) {
        console.warn("[question-bank] save skipped:", error.message);
        break; // table missing or database trouble — stop quietly
      }
      written += Math.min(100, rows.length - i);
    }
    return written;
  } catch (err) {
    console.warn("[question-bank] save failed:", err instanceof Error ? err.message : err);
    return 0;
  }
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

// ── Wrong-question reports: hidden questions are no longer served ───────────────────────────────────────────────
let hiddenCache: { at: number; keys: Set<string> } | null = null;

/** Keys of questions an admin chose to hide (cached for a minute). Empty when reporting isn't set up. */
export async function getHiddenKeys(): Promise<Set<string>> {
  if (hiddenCache && Date.now() - hiddenCache.at < 60_000) return hiddenCache.keys;
  let keys = new Set<string>();
  try {
    const db = adminClient();
    if (db) {
      const { data, error } = await db.from("question_reports").select("bank_key").eq("status", "hidden").limit(5000);
      if (!error && data) keys = new Set((data as { bank_key: string }[]).map((r) => r.bank_key));
    }
  } catch {
    /* table not created yet */
  }
  hiddenCache = { at: Date.now(), keys };
  return keys;
}

export function forgetHiddenCache(): void {
  hiddenCache = null;
}

/** Removes admin-hidden questions from a list about to be served. */
export async function dropHidden<T extends Pick<NormalizedQuestion, "prompt" | "options">>(subject: string, list: T[]): Promise<T[]> {
  const hidden = await getHiddenKeys();
  if (hidden.size === 0) return list;
  return list.filter((q) => !hidden.has(bankKey(subject, q)));
}
