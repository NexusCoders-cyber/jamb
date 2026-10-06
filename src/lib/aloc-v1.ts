/**
 * ALOC Station v1 client — https://dev.aloc.com.ng/api/v1
 *
 * Runs ALONGSIDE the legacy v2 client in aloc.ts; nothing there was removed.
 * SERVER-ONLY (reads the API key). Never import this from a client component.
 *
 * Design rules
 * ────────────
 * • Opt-in. With ALOC_PROVIDER unset (or "v2") every function here returns null
 *   without touching the network, so behaviour is exactly as before.
 * • Never throws to callers. tryV1Questions() returns null on ANY problem
 *   (bad key, 429, credits exhausted, timeout, odd payload…) and the route falls
 *   back to v2 — a student always gets a paper.
 * • Rate-limit aware. The developer plan allows 30 requests/minute, so we hold
 *   ourselves to ALOC_V1_RATE_PER_MIN (default 25) with a sliding window, honour
 *   429 / Retry-After, and trip a circuit breaker after repeated failures so a
 *   v1 outage costs one slow request, not a slow request per student.
 * • Never trusts the payload. Every question is checked (text, options a–d,
 *   a correctAnswer that points at a real option) before it can reach a student;
 *   a batch that is mostly invalid is rejected whole.
 * • Auth is the X-API-Key header. The key is never logged or put in errors.
 *
 * Credits (from ALOC's API description): L1 questions = 1 credit/request,
 * L2 metadata = 3, L3 explanation = 10, L4 intelligence = 10. We only use L1.
 */

import { nameToSlug, normalizeAlocList, slugToName, type AlocQuestion, type NormalizedQuestion } from "./aloc";

// ─── Config (read at call time so tests and Vercel env changes apply immediately) ───

const DEFAULT_BASE = "https://dev.aloc.com.ng/api/v1";

export type AlocProviderMode = "v2" | "auto";

/** "v2" (default) = legacy only. "auto" = try v1 first, fall back to v2. */
export function alocProviderMode(): AlocProviderMode {
  return (process.env.ALOC_PROVIDER ?? "").trim().toLowerCase() === "auto" ? "auto" : "v2";
}

function apiKey(): string {
  return (process.env.ALOC_V1_API_KEY ?? "").trim();
}

function baseUrl(): string {
  return (process.env.ALOC_V1_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(process.env[name]));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function v1Enabled(): boolean {
  return alocProviderMode() === "auto" && apiKey().length > 0;
}

// ─── Sliding-window rate limiter ─────────────────────────────────────────────

export class SlidingWindowLimiter {
  private stamps: number[] = [];
  constructor(
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  /** Take a slot, waiting up to maxWaitMs for one. false = no slot in time. */
  async acquire(limit: number, windowMs: number, maxWaitMs: number): Promise<boolean> {
    const deadline = this.now() + maxWaitMs;
    for (;;) {
      const t = this.now();
      this.stamps = this.stamps.filter((s) => t - s < windowMs);
      if (this.stamps.length < limit) {
        this.stamps.push(t);
        return true;
      }
      const waitMs = this.stamps[0] + windowMs - t + 5;
      if (t + waitMs > deadline) return false;
      await this.sleep(waitMs);
    }
  }

  reset() {
    this.stamps = [];
  }
}

// ─── Module state (per server instance) ──────────────────────────────────────

const limiter = new SlidingWindowLimiter();
let cooldownUntil = 0; // epoch ms — v1 is skipped until then
let consecutiveFailures = 0;
let lastCreditsMeta: { creditsUsed?: number; creditsRemaining?: number; tier?: string; at: number } | null = null;
let subjectCache: { at: number; map: Map<string, string> } | null = null;
let subjectFailAt = 0;

const SUBJECT_TTL_MS = 24 * 60 * 60 * 1000;
const SUBJECT_RETRY_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
/** How long a request will queue for a rate-limit slot before giving up and using v2. */
const MAX_QUEUE_WAIT_MS = 6_000;

/** Test hook — clears all module state. */
export function __resetV1ForTests() {
  limiter.reset();
  cooldownUntil = 0;
  consecutiveFailures = 0;
  lastCreditsMeta = null;
  subjectCache = null;
  subjectFailAt = 0;
}

/** Last credits reading ALOC reported (for health / diagnostics). */
export function getV1Status() {
  return {
    mode: alocProviderMode(),
    keyConfigured: apiKey().length > 0,
    base: baseUrl(),
    ratePerMin: envInt("ALOC_V1_RATE_PER_MIN", 25, 1, 100_000),
    coolingDownForMs: Math.max(0, cooldownUntil - Date.now()),
    credits: lastCreditsMeta,
  };
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

class V1Unavailable extends Error {}

type V1Json = { data?: unknown; meta?: { creditsUsed?: number; creditsRemaining?: number; tier?: string } } & Record<string, unknown>;

function noteFailure(coolMs = 0) {
  consecutiveFailures += 1;
  if (coolMs > 0) cooldownUntil = Math.max(cooldownUntil, Date.now() + coolMs);
  // Three strikes: stop trying v1 for a minute so students aren't made to wait on a dead service
  if (consecutiveFailures >= 3) cooldownUntil = Math.max(cooldownUntil, Date.now() + 60_000);
}

async function v1Request(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<V1Json> {
  if (Date.now() < cooldownUntil) throw new V1Unavailable("cooling down");
  const ok = await limiter.acquire(envInt("ALOC_V1_RATE_PER_MIN", 25, 1, 100_000), 60_000, MAX_QUEUE_WAIT_MS);
  if (!ok) throw new V1Unavailable("rate budget used up");

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-API-Key": apiKey(),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    noteFailure();
    throw new V1Unavailable("network error or timeout");
  }

  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  if (res.headers.get("x-ratelimit-remaining") !== null && Number.isFinite(remaining) && remaining <= 0) {
    cooldownUntil = Math.max(cooldownUntil, Date.now() + 5_000); // window is empty — let it refill
  }

  if (!res.ok) {
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after"));
      noteFailure(Math.min(Math.max(Number.isFinite(retry) && retry > 0 ? retry * 1000 : 15_000, 2_000), 120_000));
    } else if (res.status === 401 || res.status === 403) {
      noteFailure(5 * 60_000); // bad key / plan — don't hammer
      console.warn(`ALOC v1: HTTP ${res.status} (check ALOC_V1_API_KEY and plan)`);
    } else if (res.status === 402) {
      noteFailure(10 * 60_000); // out of credits
      console.warn("ALOC v1: HTTP 402 (credits exhausted?)");
    } else {
      noteFailure();
    }
    throw new V1Unavailable(`HTTP ${res.status}`);
  }

  let json: V1Json;
  try {
    json = (await res.json()) as V1Json;
  } catch {
    noteFailure();
    throw new V1Unavailable("unreadable response");
  }
  consecutiveFailures = 0;
  if (json?.meta && typeof json.meta === "object") {
    lastCreditsMeta = { ...pickMeta(json.meta), at: Date.now() };
    const left = lastCreditsMeta.creditsRemaining;
    if (typeof left === "number" && left >= 0 && left < 500) console.warn(`ALOC v1: only ${left} credits remaining`);
  }
  return json;
}

function pickMeta(m: NonNullable<V1Json["meta"]>) {
  return { creditsUsed: m.creditsUsed, creditsRemaining: m.creditsRemaining, tier: m.tier };
}

// ─── Subject resolution ──────────────────────────────────────────────────────

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Extra names ALOC might use for our slugs. The live /subjects list decides what is real. */
const SUBJECT_HINTS: Record<string, string[]> = {
  english: ["english", "englishlanguage", "useofenglish"],
  englishlit: ["literatureinenglish", "englishliterature", "literature", "lit"],
  civiledu: ["civiceducation", "civic"],
  crk: ["christianreligiousknowledge", "christianreligiousstudies", "christianreligiouseducation"],
  irk: ["islamicreligiousknowledge", "islamicreligiousstudies", "islamicstudies"],
  currentaffairs: ["currentaffairs"],
};

async function loadSubjectMap(): Promise<Map<string, string> | null> {
  const now = Date.now();
  if (subjectCache && now - subjectCache.at < SUBJECT_TTL_MS) return subjectCache.map;
  if (now - subjectFailAt < SUBJECT_RETRY_MS) return subjectCache?.map ?? null;
  try {
    const json = await v1Request("/subjects");
    const list = Array.isArray(json.data)
      ? json.data
      : Array.isArray((json.data as { subjects?: unknown } | undefined)?.subjects)
        ? ((json.data as { subjects: unknown[] }).subjects)
        : [];
    const map = new Map<string, string>();
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const s = raw as { name?: unknown; displayName?: unknown; code?: unknown; aliases?: unknown };
      const machine = typeof s.name === "string" && s.name ? s.name : typeof s.code === "string" ? s.code : "";
      if (!machine) continue;
      const keys = [s.name, s.displayName, s.code, ...(Array.isArray(s.aliases) ? s.aliases : [])];
      for (const k of keys) if (norm(k)) map.set(norm(k), machine);
    }
    if (map.size === 0) throw new V1Unavailable("no subjects");
    subjectCache = { at: now, map };
    return map;
  } catch {
    subjectFailAt = now;
    return subjectCache?.map ?? null;
  }
}

export async function resolveV1Subject(slug: string): Promise<string | null> {
  const map = await loadSubjectMap();
  if (!map) return null;
  const candidates = [slug, slugToName(slug), ...(SUBJECT_HINTS[slug] ?? [])].map(norm);
  for (const c of candidates) {
    const hit = map.get(c);
    if (hit) return hit;
  }
  return null;
}

// ─── Mapping v1 → the shape the rest of the app already understands ──────────

type V1Question = {
  id?: unknown;
  text?: unknown;
  options?: Record<string, unknown> | null;
  correctAnswer?: unknown;
  subject?: unknown;
  year?: unknown;
  section?: unknown;
  imageUrl?: unknown;
  questionNumber?: unknown;
  hasPassage?: unknown;
  category?: unknown;
};

const LETTERS = ["a", "b", "c", "d", "e"] as const;

/** One v1 question → legacy raw shape (so aloc.ts's HTML/image/passage handling is reused), or null if unsafe. */
export function mapV1Question(q: V1Question): AlocQuestion | null {
  if (!q || typeof q !== "object") return null;
  const text = typeof q.text === "string" ? q.text : "";
  const image = typeof q.imageUrl === "string" && q.imageUrl.trim() ? q.imageUrl.trim() : undefined;
  if (!text.trim() && !image) return null;

  const option: Record<string, string> = {};
  for (const l of LETTERS) {
    const v = q.options?.[l];
    if (typeof v === "string" && v.trim()) option[l] = v;
  }
  // a–d are mandatory in ALOC's own schema; e is optional
  if (!option.a || !option.b || !option.c || !option.d) return null;

  const answer = typeof q.correctAnswer === "string" ? q.correctAnswer.trim().toLowerCase() : "";
  if (!option[answer]) return null; // the key must point at a real, non-empty option

  const id = typeof q.id === "string" || typeof q.id === "number" ? q.id : null;
  if (id === null) return null;

  return {
    id,
    question: text,
    option,
    answer,
    section: typeof q.section === "string" && q.section ? q.section : undefined,
    image,
    examtype: "utme",
    examyear: typeof q.year === "number" ? q.year : undefined,
    subject: typeof q.subject === "string" ? q.subject : undefined,
    hasPassage: q.hasPassage === true,
    questionNub: typeof q.questionNumber === "number" ? q.questionNumber : null,
    category: typeof q.category === "string" ? q.category : null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

function presetFor(count: number): { preset: "jamb_standard_40" | "micro_test_10" | "custom"; count?: number } {
  if (count === 40) return { preset: "jamb_standard_40" };
  if (count === 10) return { preset: "micro_test_10" };
  return { preset: "custom", count };
}

/** Largest single set we ask v1 for; anything bigger goes to v2. */
const MAX_V1_COUNT = 100;
/** Accept a v1 batch only if at least this share of what we asked for survived validation. */
const MIN_YIELD = 0.8;

/**
 * Balanced, option-shuffled questions for a subject from v1 — or null (never throws)
 * when v1 is off, can't help (English passages, unknown subject, huge sets) or fails.
 * Callers MUST fall back to v2 on null.
 */
export async function tryV1Questions(subject: string, count: number, opts: { seed?: string } = {}): Promise<NormalizedQuestion[] | null> {
  if (!v1Enabled()) return null;
  try {
    const slug = nameToSlug(subject);
    // English papers (comprehension/cloze passages, set texts) stay on the proven v2 assembly for now
    if (slug === "english") return null;
    const want = Math.floor(count);
    if (!Number.isFinite(want) || want < 1 || want > MAX_V1_COUNT) return null;

    const v1Subject = await resolveV1Subject(slug);
    if (!v1Subject) return null;

    const json = await v1Request("/assessments/generate", {
      method: "POST",
      body: {
        subject: v1Subject,
        examType: "jamb",
        ...presetFor(want),
        shuffleOptions: true,
        seed: opts.seed ?? `qubit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      },
    });

    const list = (json.data as { questions?: unknown } | undefined)?.questions;
    if (!Array.isArray(list)) return null;

    const mapped = list.map((q) => mapV1Question(q as V1Question)).filter((q): q is AlocQuestion => q !== null);
    const { questions } = normalizeAlocList(mapped, slugToName(slug));
    if (questions.length < Math.ceil(want * MIN_YIELD)) {
      console.warn(`ALOC v1: only ${questions.length}/${want} usable questions for ${slug} — using v2`);
      return null;
    }
    return questions;
  } catch (err) {
    if (!(err instanceof V1Unavailable)) console.warn("ALOC v1: unexpected error —", err instanceof Error ? err.message : "unknown");
    return null;
  }
}

// ─── Admin diagnostics ───────────────────────────────────────────────────────

export type V1Diagnostics = {
  ok: boolean;
  status: ReturnType<typeof getV1Status>;
  health?: unknown;
  subjects?: { total: number; supported: string[]; unsupported: string[] };
  generate?: {
    subject: string;
    requested: number;
    returned: number;
    valid: number;
    withImages: number;
    withPassage: number;
    imageHosts: string[];
    sample?: { prompt: string; options: number; year?: number };
  };
  answerCheck?: { checked: number; matched: number; mismatched: number; note: string };
  notes: string[];
};

/**
 * One-click health check of the whole v1 pipeline using a small paper (~12 credits).
 * The answer check is the important one: it re-reads a few questions from the canonical
 * (unshuffled) endpoint and confirms the correct option's TEXT is the same, which proves
 * `shuffleOptions` keeps correctAnswer consistent. Admin-only at the route.
 */
export async function runV1Diagnostics(subject = "mathematics"): Promise<V1Diagnostics> {
  const notes: string[] = [];
  const out: V1Diagnostics = { ok: false, status: getV1Status(), notes };
  if (!apiKey()) {
    notes.push("ALOC_V1_API_KEY is not set on this deployment.");
    return out;
  }
  if (alocProviderMode() !== "auto") notes.push('ALOC_PROVIDER is not "auto", so students are still on v2 (this check ran anyway).');

  try {
    const healthRes = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    out.health = await healthRes.json().catch(() => ({ status: healthRes.status }));
  } catch {
    notes.push("Health endpoint unreachable from this server.");
    return out;
  }

  try {
    const map = await loadSubjectMap();
    if (map) {
      const slugs = ["english", "mathematics", "physics", "chemistry", "biology", "government", "economics", "geography", "commerce", "accounting", "englishlit", "crk", "irk", "civiledu", "insurance", "history", "currentaffairs"];
      const supported: string[] = [];
      const unsupported: string[] = [];
      for (const s of slugs) ((await resolveV1Subject(s)) ? supported : unsupported).push(s);
      out.subjects = { total: new Set(map.values()).size, supported, unsupported };
      if (unsupported.length) notes.push(`Not found on v1 (will use v2): ${unsupported.join(", ")}`);
    } else {
      notes.push("Could not read the v1 subject list.");
    }

    const slug = nameToSlug(subject);
    const v1Subject = await resolveV1Subject(slug);
    if (!v1Subject) {
      notes.push(`Subject "${subject}" was not found on v1.`);
      return out;
    }
    const want = 10;
    const json = await v1Request("/assessments/generate", {
      method: "POST",
      body: { subject: v1Subject, examType: "jamb", preset: "micro_test_10", shuffleOptions: true, seed: `diag_${Date.now().toString(36)}` },
    });
    const list = (json.data as { questions?: unknown[] } | undefined)?.questions ?? [];
    const raw = list as V1Question[];
    const mapped = raw.map(mapV1Question).filter((q): q is AlocQuestion => q !== null);
    const hosts = new Set<string>();
    for (const q of raw) {
      if (typeof q?.imageUrl === "string") {
        try { hosts.add(new URL(q.imageUrl).hostname); } catch { /* relative or malformed */ }
      }
    }
    out.generate = {
      subject: v1Subject,
      requested: want,
      returned: raw.length,
      valid: mapped.length,
      withImages: raw.filter((q) => typeof q?.imageUrl === "string" && q.imageUrl).length,
      withPassage: raw.filter((q) => q?.hasPassage === true).length,
      imageHosts: [...hosts],
      sample: raw[0] ? { prompt: String(raw[0].text ?? "").slice(0, 90), options: Object.keys(raw[0].options ?? {}).length, year: typeof raw[0].year === "number" ? raw[0].year : undefined } : undefined,
    };
    if (mapped.length < raw.length) notes.push(`${raw.length - mapped.length} of ${raw.length} questions failed validation and would be dropped.`);

    // Shuffle-consistency: compare the correct option's text against the canonical record
    let matched = 0;
    let mismatched = 0;
    const toCheck = raw.slice(0, 3).filter((q) => typeof q?.id === "string");
    for (const q of toCheck) {
      try {
        const canon = (await v1Request(`/questions/${encodeURIComponent(String(q.id))}`)).data as V1Question | undefined;
        const a = String(q.correctAnswer ?? "").toLowerCase();
        const b = String(canon?.correctAnswer ?? "").toLowerCase();
        const shuffledText = norm(q.options?.[a]);
        const canonText = norm(canon?.options?.[b]);
        if (shuffledText && shuffledText === canonText) matched += 1;
        else mismatched += 1;
      } catch {
        notes.push("Could not fetch a canonical question to cross-check answers.");
        break;
      }
    }
    out.answerCheck = {
      checked: matched + mismatched,
      matched,
      mismatched,
      note: mismatched > 0 ? "DO NOT enable v1: correctAnswer does not match the shuffled options." : matched > 0 ? "Correct answers stay consistent after shuffling." : "Not checked.",
    };
    out.status = getV1Status();
    out.ok = mapped.length >= Math.ceil(want * MIN_YIELD) && mismatched === 0;
  } catch (err) {
    notes.push(err instanceof V1Unavailable ? `v1 call failed: ${err.message}` : "Unexpected error during the check.");
  }
  return out;
}
