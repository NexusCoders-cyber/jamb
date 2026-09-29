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

  // Instruction tell-tales — ALOC prefixes like "In each of questions 68 to 84,"
  // or "choose the option nearest in meaning" are never passages.
  const looksLikeInstruction =
    /^(?:in (?:each|all) of|choose |select |fill |answer |questions? \d+|section [a-d]|lexis|structure|oral forms|comprehension|from the words|from the options|the questions? below|read the following)/i.test(text) ||
    /(?:choose|select|nearest in meaning|opposite in meaning|fill (?:each|the) gap|best completes|most appropriate|option that best)/i.test(text);

  if (looksLikeInstruction) return "instruction";

  // Dialogue tell-tales — a speaker label followed by a colon, possibly
  // several times ("BEP0: ...\nSERI: ..."). These are often short, so we
  // check before the length thresholds.
  const speakerLines = text.match(/^[A-Z][A-Z0-9 .\u2019']{1,24}:/gm) ?? [];
  if (speakerLines.length >= 1) return "passage";

  // Screenplay/résumé tell-tales — long dashes with action cues
  if (/\s[-\u2013\u2014]\s/.test(text) && text.length >= 200) return "passage";

  // Sentence-count and length signals (previous logic, kept as fallback)
  const sentences = (text.match(/[.!?:][\s"']/g) ?? []).length;
  if (text.length >= 140 && sentences >= 3) return "passage";
  if (text.length >= 400) return "passage";
  return "instruction";
}

const NOVEL_TITLE_PATTERNS: { kind: "known" | "quoted" | "run"; re: RegExp }[] = [
  // Explicit known JAMB/UTME set texts — cleanest signal, tried first
  { kind: "known", re: /\b(The Lekki Headmaster|The Life Changer|Sweet Sixteen|The Last Days at Forcados High(?: School)?|The Successors|Independence|Nineteen Eighty-?Four|The Joys of Motherhood|Harvest of Corruption|Sons and Daughters|The Tempest|Romeo and Juliet|Hamlet|Macbeth|Ambush|The Proud King|The Anvil and the Hammer)\b/i },
  // Title in quotes: "based on Bolaji Abdullahi's 'Sweet Sixteen'"
  { kind: "quoted", re: /(?:based on|drawn from|from the novel|extracted from|extract for question(?:s)?(?: is)?(?: taken)? from)[^:\n]*?["\u201c\u2018']([^"\u201d\u2019']{3,80})["\u201d\u2019']/i },
  // Run of 2+ capitalized words after "based on/drawn from", e.g. "based on George Orwell's Nineteen Eighty-Four"
  { kind: "run", re: /(?:based on|drawn from|from)\s+([A-Z][\w'\u2019.\-]+(?:\s+[A-Z][\w'\u2019.\-]+){1,5})/ },
];

/** Tail fragments that mean we matched an author/category, not a title. */
const NOVEL_TITLE_STOPLIST = /literary appreciation|general literary|literary principles|oral english|lexis|structure|comprehension|register|^(?:the\s+)?(?:poems?|poetry|novel|book|play|prose|drama|text)$/i;
const TRAILING_GENRE_WORD = /\s+(?:novel|book|play|poem|prose|drama|text)s?$/i;

/**
 * Fuzzy novel-title match: ignores punctuation/case so "Nineteen Eighty-Four",
 * "Nineteen Eighty Four" and "Eightyfour" all resolve to the same set text.
 */
export function novelMatches(questionNovel: string | null | undefined, wanted: string): boolean {
  if (!questionNovel || !wanted) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(questionNovel);
  const b = norm(wanted);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Best-effort extraction of the novel/text a question is drawn from.
 * ALOC keeps this in free-form `section` text, so we parse known title
 * patterns. Returns a clean title or null.
 */
export function detectNovel(
  sectionText: string | null | undefined,
  prompt?: string,
  /** Strict mode: quoted titles or known set texts only — used for English */
  opts: { strict?: boolean } = {},
): string | null {
  const haystack = `${sectionText ?? ""}\n${prompt ?? ""}`;
  // Strict mode (English subject): known set texts or quoted titles only —
  // free-form "based on ..." prose is too noisy for the novel filter.
  const patterns = opts.strict
    ? NOVEL_TITLE_PATTERNS.filter((p) => p.kind === "known" || p.kind === "quoted")
    : NOVEL_TITLE_PATTERNS;
  for (const { kind, re } of patterns) {
    const match = haystack.match(re);
    const raw = kind === "known" ? match?.[0] : match?.[1];
    if (raw) {
      let title = raw
        .trim()
        .replace(/^[\u201c\u2018"']|[\u201d\u2019"'.,\s]+$/g, "")
        .replace(/\s*[\u2019']s$/i, "") // trailing possessive → author, not title
        .replace(/^[\w.\s]+[\u2019']s\s+(?=[A-Z])/, "") // author prefix: "Bolaji Abdullahi's X"
        .replace(TRAILING_GENRE_WORD, "")
        .trim();
      if (title.length < 3 || title.length > 80) continue;
      if (NOVEL_TITLE_STOPLIST.test(title)) continue;
      // A single word is only trusted for known titles / quoted captures
      if (!title.includes(" ") && kind === "run") continue;
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

export function normalizeAlocQuestion(
  q: AlocQuestion,
  defaultSubject?: string,
  /** Passage carried forward from the previous question in the same batch (see below) */
  passage?: { text: string; kind: "passage" | "instruction" } | null,
): NormalizedQuestion | null {
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
  const sectionKind = section ? classifySection(section) : null;
  // Passage continuity: ALOC 2022 English leaves `section` EMPTY on the 2nd-Nth
  // questions of a comprehension set — the passage text only ships on the first
  // question. Carry the most recent passage forward so every question in the
  // set renders with its passage instead of orphaned bare prompts.
  const carrySection = !section && passage && passage.text && passage.kind === "passage" ? passage.text : null;
  const image = q.image && typeof q.image === "string" && q.image.trim().length > 0 ? q.image.trim() : null;
  const year = q.examyear ? String(q.examyear) : null;
  const subject = q.subject ? slugToName(q.subject) : defaultSubject ?? null;
  const novel =
    subject === "Literature in English" || subject === "English Language" || /novel/i.test(rawSection)
      ? detectNovel(rawSection, subject === "Literature in English" ? prompt : undefined, { strict: subject === "English Language" })
      : null;

  return {
    id: String(q.id ?? Math.random().toString(36).slice(2)),
    prompt,
    promptSegments,
    options,
    optionSegments,
    answer: answerIdx,
    explanation,
    section: (section || carrySection) || null,
    sectionKind: sectionKind ?? (carrySection ? "passage" : null),
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

  // Thread the last-seen passage forward: comprehension sets repeat the passage
  // only on their first question, later ones carry an empty `section`.
  let carry: { text: string; kind: "passage" | "instruction" } | null = null;
  const normalized = rawList
    .map((q) => {
      const nq = normalizeAlocQuestion(q, slugToName(slug), carry);
      if (nq?.section && nq.sectionKind === "passage") {
        carry = { text: nq.section, kind: "passage" };
      } else if (nq?.section) {
        carry = null; // a new instruction block ends the previous passage set
      }
      return nq;
    })
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

  // Thread the last-seen passage forward (same rule as /q/{count} above)
  let carry: { text: string; kind: "passage" | "instruction" } | null = null;
  return rawList
    .map((q) => {
      const nq = normalizeAlocQuestion(q, slugToName(slug), carry);
      if (nq?.section && nq.sectionKind === "passage") {
        carry = { text: nq.section, kind: "passage" };
      } else if (nq?.section) {
        carry = null;
      }
      return nq;
    })
    .filter((q): q is NormalizedQuestion => q !== null);
}
