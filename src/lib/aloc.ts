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
  /** Prompt split into rich segments so italics/bold survive rendering */
  promptSegments?: RichSegment[] | null;
  options: string[];
  /** Options split into rich segments, aligned with `options` by index */
  optionSegments?: (RichSegment[] | null)[];
  answer: number;
  explanation: string | null;
  section?: string | null;
  /** Classified role of `section` — comprehension passages get special rendering */
  sectionKind?: "passage" | "instruction" | null;
  /** Novel/title the question is drawn from (e.g. "Sweet Sixteen") when detectable */
  novel?: string | null;
  /** The exam body this question actually came from (e.g. utme, wassce) */
  examtype?: string | null;
  image?: string | null;
  year?: string | null;
  subject?: string | null;
};

export type RichSegment = { text: string; italic?: boolean; bold?: boolean };

function unescapeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&[a-z]+;/gi, "");
}

/**
 * Convert a limited set of inline HTML tags into rich text segments.
 * <em>/<i> become italic, <strong>/<b> become bold, everything else is
 * stripped so words like "nearest" highlighted in ALOC instructions stay
 * visible instead of silently disappearing.
 */
export function htmlToSegments(input: string): RichSegment[] {
  const parts: RichSegment[] = [];
  let italic = false;
  let bold = false;
  let buffer = "";

  const flush = () => {
    const text = unescapeEntities(buffer).replace(/\s+/g, " ");
    if (text.trim().length > 0) {
      parts.push({ text, italic: italic || undefined, bold: bold || undefined });
    }
    buffer = "";
  };

  const tags = input.split(/(<[^>]+>)/);
  for (const part of tags) {
    if (/^<[^>]+>$/.test(part)) {
      const tag = part.toLowerCase();
      if (/^<br\s*\/?>$/.test(tag) || tag === "</p>") {
        buffer += " ";
      } else if (tag === "<em>" || tag === "<i>") {
        flush();
        italic = true;
      } else if (tag === "</em>" || tag === "</i>") {
        flush();
        italic = false;
      } else if (tag === "<strong>" || tag === "<b>") {
        flush();
        bold = true;
      } else if (tag === "</strong>" || tag === "</b>") {
        flush();
        bold = false;
      }
      // all other tags are ignored
    } else {
      buffer += part;
    }
  }
  flush();
  return parts.length > 0 ? parts : [{ text: unescapeEntities(input).replace(/\s+/g, " ").trim() }];
}

/** Plain-text version of htmlToSegments — joins rich segments back together. */
function stripHtml(input: string): string {
  return htmlToSegments(input)
    .map((s) => s.text)
    .join("")
    .trim();
}

/**
 * Classify a `section` value: comprehension passages (long prose the
 * questions refer to) get their own reader panel; short strings like
 * "choose the option nearest in meaning..." are instructions.
 */
export function classifySection(sectionText: string | null | undefined): "passage" | "instruction" | null {
  if (!sectionText) return null;
  const text = sectionText.trim();
  if (text.length === 0) return null;
  // Long multi-sentence text = an actual passage to read
  const sentences = (text.match(/[.!?:][\s"']/g) ?? []).length;
  if (text.length >= 140 && sentences >= 3) return "passage";
  if (text.length >= 400) return "passage";
  return "instruction";
}

const NOVEL_TITLE_PATTERNS: RegExp[] = [
  /(?:based on|drawn from|from the novel|extracted from|extract for question(?:s)?(?: is)?(?: taken)? from)[^:\n]*?["\u201c\u2018']([^"\u201d\u2019']{3,80})["\u201d\u2019']/i,
  /(?:based on|drawn from|from)\s+((?:[A-Z]\w*[.,']?(?:\s+(?:and\s+)?){0,3}){1,6}(?:['\u2019]s)?\s+(?:novel|book|text|play|poem|prose|drama)[^.,\n]*)/i,
  // Explicit known JAMB/UTME set texts, even when the sentence is terse
  /\b(The Lekki Headmaster|The Life Changer|Sweet Sixteen|The Last Days at Forcados High(?: School)?|The Successors|Independence|Nineteen Eighty-?Four|The Joys of Motherhood|Harvest of Corruption|Sons and Daughters|The Tempest|Romeo and Juliet|Hamlet|Macbeth|Ambush|The Proud King|The Anvil and the Hammer)\b/i,
];

/**
 * Best-effort extraction of the novel/text a question is drawn from.
 * ALOC keeps this in free-form `section` text, so we parse known title
 * patterns. Returns a clean title or null.
 */
export function detectNovel(sectionText: string | null | undefined, prompt?: string): string | null {
  const haystack = `${sectionText ?? ""}\n${prompt ?? ""}`;
  for (const pattern of NOVEL_TITLE_PATTERNS) {
    const match = haystack.match(pattern);
    if (match?.[1]) {
      let title = match[1].trim().replace(/^[\u201c\u2018"']|[\u201d\u2019"']$/g, "").trim();
      if (title.length > 80) title = title.slice(0, 80).trim();
      return title;
    }
  }
  return null;
}

function resolveOptions(q: AlocQuestion): { text: string; segments: RichSegment[] | null }[] {
  const fromList = (opt: unknown): { text: string; segments: RichSegment[] | null } | null => {
    const raw = String(opt ?? "");
    if (raw.trim().length === 0) return null;
    const segments = htmlToSegments(raw);
    const text = segments.map((s) => s.text).join("").trim();
    const hasRich = segments.some((s) => s.italic || s.bold);
    return text ? { text, segments: hasRich ? segments : null } : null;
  };

  if (Array.isArray(q.options)) {
    return q.options.map(fromList).filter((o): o is { text: string; segments: RichSegment[] } => o !== null);
  }
  const optObj = q.option ?? (typeof q.options === "object" ? q.options : null);
  if (!optObj) return [];

  const keys: (keyof AlocRawOption)[] = ["a", "b", "c", "d", "e"];
  const list: { text: string; segments: RichSegment[] | null }[] = [];
  for (const k of keys) {
    const val = optObj[k];
    if (typeof val === "string" && val.trim().length > 0) {
      const o = fromList(val);
      if (o) list.push(o);
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
  const resolved = resolveOptions(q);
  const options = resolved.map((o) => o.text);
  if (!prompt || options.length < 2) return null;

  // Keep italics/bold when present (English lexis questions mark keywords)
  const rawPromptSegments = htmlToSegments(q.question ?? "");
  const promptSegments = rawPromptSegments.some((s) => s.italic || s.bold) ? rawPromptSegments : null;
  const optionSegments = resolved.map((o) => o.segments);

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
  const novel =
    subject === "Literature in English" || subject === "English Language" || /novel/i.test(rawSection)
      ? detectNovel(rawSection, subject === "Literature in English" ? prompt : undefined)
      : null;

  return {
    id: String(q.id ?? Math.random().toString(36).slice(2)),
    prompt,
    promptSegments,
    options,
    optionSegments,
    answer: answerIdx,
    explanation,
    section: section || null,
    sectionKind: section ? classifySection(section) : null,
    novel,
    examtype: typeof q.examtype === "string" ? q.examtype : null,
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
