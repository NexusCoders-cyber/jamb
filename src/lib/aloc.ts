/**
 * ALOC API client
 * Base: https://questions.aloc.com.ng/api/v2
 * Docs: https://github.com/Seunope/aloc-endpoints/wiki/API-Parameters
 *
 * Auth: Bearer token in Authorization header (QB-xxxx token from .env)
 */

const ALOC_BASE = "https://questions.aloc.com.ng/api/v2";

// ─── All supported ALOC subject slugs ────────────────────────────────────────
// These are the exact lowercase slugs the ALOC API accepts.
export const ALOC_SUBJECTS: { slug: string; name: string }[] = [
  { slug: "english", name: "English Language" },
  { slug: "mathematics", name: "Mathematics" },
  { slug: "physics", name: "Physics" },
  { slug: "chemistry", name: "Chemistry" },
  { slug: "biology", name: "Biology" },
  { slug: "government", name: "Government" },
  { slug: "economics", name: "Economics" },
  { slug: "geography", name: "Geography" },
  { slug: "commerce", name: "Commerce" },
  { slug: "accounting", name: "Accounting" },
  { slug: "englishlit", name: "Literature in English" },
  { slug: "crk", name: "Christian Religious Knowledge" },
  { slug: "irk", name: "Islamic Religious Knowledge" },
  { slug: "civiledu", name: "Civic Education" },
  { slug: "insurance", name: "Insurance" },
  { slug: "history", name: "History" },
  { slug: "currentaffairs", name: "Current Affairs" },
];

/** Map a display name to an ALOC slug. Falls back to lowercase of name. */
export function nameToSlug(name: string): string {
  const found = ALOC_SUBJECTS.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() || s.slug === name.toLowerCase(),
  );
  return found?.slug ?? name.toLowerCase().replace(/\s+/g, "");
}

/** Map an ALOC slug to a display name. */
export function slugToName(slug: string): string {
  return ALOC_SUBJECTS.find((s) => s.slug === slug)?.name ?? slug;
}

// ─── Response types ───────────────────────────────────────────────────────────
export type AlocQuestion = {
  id: number;
  question: string;
  option: { a: string; b: string; c: string; d: string; e?: string };
  answer: string; // "a" | "b" | "c" | "d"
  solution?: string;
  examtype?: string;
  examyear?: string;
  subject?: string;
};

export type AlocResponse = {
  status: boolean;
  message: string;
  token?: number;
  data: AlocQuestion | AlocQuestion[];
};

// ─── Normalizer (ALOC → our internal ExamQuestion shape) ─────────────────────
export type NormalizedQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number; // 0-based index
  explanation: string | null;
};

export function normalizeAlocQuestion(q: AlocQuestion): NormalizedQuestion | null {
  const opts = [q.option.a, q.option.b, q.option.c, q.option.d].filter(Boolean);
  if (opts.length < 2 || !q.question?.trim()) return null;

  const answerMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
  const answerIdx = answerMap[q.answer?.toLowerCase()];
  if (answerIdx === undefined || answerIdx >= opts.length) return null;

  return {
    id: String(q.id),
    prompt: q.question,
    options: opts,
    answer: answerIdx,
    explanation: q.solution ?? null,
  };
}

// ─── Fetchers (called server-side only from the /api/aloc route) ──────────────

function alocHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Fetch many questions for a subject (up to 40 per call).
 * Uses the /m endpoint which returns an array.
 */
export async function fetchAlocQuestions(
  apiKey: string,
  subject: string,
  opts: { year?: string; type?: string } = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years") params.set("year", opts.year);
  if (opts.type && opts.type !== "utme") params.set("type", opts.type);

  const url = `${ALOC_BASE}/m?${params.toString()}`;

  const res = await fetch(url, {
    headers: alocHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`ALOC /m responded ${res.status}`);

  const json = (await res.json()) as AlocResponse;
  const data = Array.isArray(json.data) ? json.data : [];
  return data.flatMap((q) => {
    const n = normalizeAlocQuestion(q);
    return n ? [n] : [];
  });
}

/**
 * Fetch a specific count of questions.
 * Uses /q/{count} endpoint (max 40).
 */
export async function fetchAlocQuestionCount(
  apiKey: string,
  subject: string,
  count: number,
  opts: { year?: string; type?: string } = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const clamped = Math.min(Math.max(count, 1), 40);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years") params.set("year", opts.year);
  if (opts.type) params.set("type", opts.type);

  const url = `${ALOC_BASE}/q/${clamped}?${params.toString()}`;

  const res = await fetch(url, {
    headers: alocHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`ALOC /q/${clamped} responded ${res.status}`);

  const json = (await res.json()) as AlocResponse;
  const data = Array.isArray(json.data) ? json.data : json.data ? [json.data as AlocQuestion] : [];
  return data.flatMap((q) => {
    const n = normalizeAlocQuestion(q);
    return n ? [n] : [];
  });
}
