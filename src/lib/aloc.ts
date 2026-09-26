/**
 * ALOC API client
 * Base: https://questions.aloc.com.ng/api/v2
 * Docs: https://github.com/Seunope/aloc-endpoints/wiki/API-Parameters
 *
 * Auth: AccessToken header (e.g. ALOC-xxxx or QB-xxxx from .env)
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
  const clean = name.trim().toLowerCase();
  const found = ALOC_SUBJECTS.find(
    (s) => s.name.toLowerCase() === clean || s.slug === clean,
  );
  if (found) return found.slug;
  if (clean.includes("english") && !clean.includes("lit")) return "english";
  if (clean.includes("literature")) return "englishlit";
  if (clean.includes("math")) return "mathematics";
  if (clean.includes("crk") || clean.includes("christian")) return "crk";
  if (clean.includes("irk") || clean.includes("islamic")) return "irk";
  if (clean.includes("civic")) return "civiledu";
  if (clean.includes("current")) return "currentaffairs";
  return clean.replace(/[^a-z0-9]/g, "");
}

/** Map an ALOC slug to a display name. */
export function slugToName(slug: string): string {
  const clean = slug.trim().toLowerCase();
  return ALOC_SUBJECTS.find((s) => s.slug === clean)?.name ?? slug;
}

// ─── Response types ───────────────────────────────────────────────────────────
export type AlocRawOption = Record<string, string | undefined> & {
  a?: string;
  b?: string;
  c?: string;
  d?: string;
  e?: string;
};

export type AlocQuestion = {
  id: number | string;
  question: string;
  option?: AlocRawOption;
  options?: AlocRawOption | string[];
  answer: string | number;
  solution?: string;
  explanation?: string;
  section?: string;
  image?: string;
  examtype?: string;
  examyear?: string | number;
  subject?: string;
};

export type AlocResponse = {
  status?: boolean | number;
  message?: string;
  token?: number;
  data?: AlocQuestion | AlocQuestion[];
};

// ─── Normalizer (ALOC → our internal ExamQuestion shape) ─────────────────────
export type NormalizedQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string | null;
  section?: string | null;
  image?: string | null;
  year?: string | null;
  subject?: string | null;
};

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function resolveOptions(q: AlocQuestion): string[] {
  if (Array.isArray(q.options)) {
    return q.options.map((opt) => stripHtml(String(opt))).filter(Boolean);
  }
  const optObj = q.option ?? (typeof q.options === "object" ? q.options : null);
  if (!optObj) return [];

  const keys: (keyof AlocRawOption)[] = ["a", "b", "c", "d", "e"];
  const list: string[] = [];
  for (const k of keys) {
    const val = optObj[k];
    if (typeof val === "string" && val.trim().length > 0) {
      list.push(stripHtml(val));
    }
  }
  return list;
}

export function normalizeAlocQuestion(q: AlocQuestion, defaultSubject?: string): NormalizedQuestion | null {
  if (!q) return null;
  // Some ALOC questions (e.g. stress-pattern) put the actual prompt in `section`
  // and leave `question` empty. Fall back to section when that happens.
  const rawPrompt = stripHtml(q.question ?? "");
  const rawSection = stripHtml(q.section ?? "");
  const prompt = rawPrompt || rawSection;
  const options = resolveOptions(q);
  if (!prompt || options.length < 2) return null;

  let answerIdx = -1;
  if (typeof q.answer === "number") {
    answerIdx = q.answer;
  } else if (typeof q.answer === "string") {
    const trimmed = q.answer.trim().toLowerCase();
    const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
    if (trimmed in map) {
      answerIdx = map[trimmed];
    } else {
      const parsed = parseInt(trimmed, 10);
      if (!Number.isNaN(parsed)) answerIdx = parsed;
    }
  }

  if (answerIdx < 0 || answerIdx >= options.length) {
    answerIdx = 0;
  }

  const rawSolution = q.solution ?? q.explanation;
  const explanation = rawSolution ? stripHtml(rawSolution) : null;
  // Only include section as a separate field if it wasn't already used as the prompt
  const section = rawSection && rawSection !== prompt ? rawSection : null;
  const image = q.image && typeof q.image === "string" && q.image.trim().length > 0 ? q.image.trim() : null;
  const year = q.examyear ? String(q.examyear) : null;
  const subject = q.subject ? slugToName(q.subject) : defaultSubject ?? null;

  return {
    id: String(q.id ?? Math.random().toString(36).slice(2)),
    prompt,
    options,
    answer: answerIdx,
    explanation,
    section: section || null,
    image,
    year,
    subject,
  };
}

// ─── Fetchers (called server-side only from the /api/aloc route) ──────────────

function alocHeaders(apiKey: string) {
  const token = apiKey.trim().replace(/^Bearer\s+/i, "");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    AccessToken: token,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Fetch a specific count of questions.
 * Uses /q/{count} endpoint (max 40) or /m.
 */
export async function fetchAlocQuestionCount(
  apiKey: string,
  subject: string,
  count: number,
  opts: { year?: string; type?: string } = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const clamped = Math.min(Math.max(count, 1), 60);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years") params.set("year", opts.year);
  if (opts.type) params.set("type", opts.type);

  const endpoint = clamped <= 40 ? `${ALOC_BASE}/q/${clamped}?${params.toString()}` : `${ALOC_BASE}/m?${params.toString()}`;

  const res = await fetch(endpoint, {
    headers: alocHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`ALOC API returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as AlocResponse;
  const rawList = Array.isArray(json.data)
    ? json.data
    : json.data
      ? [json.data]
      : [];

  const normalized = rawList
    .map((q) => normalizeAlocQuestion(q, slugToName(slug)))
    .filter((q): q is NormalizedQuestion => q !== null);

  return normalized.slice(0, count);
}

/**
 * Fetch bulk questions for a subject (default ~40).
 * Uses the /m endpoint.
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
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`ALOC API returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as AlocResponse;
  const rawList = Array.isArray(json.data)
    ? json.data
    : json.data
      ? [json.data]
      : [];

  return rawList
    .map((q) => normalizeAlocQuestion(q, slugToName(slug)))
    .filter((q): q is NormalizedQuestion => q !== null);
}
