/**
 * ALOC API client
 * Base: https://questions.aloc.com.ng/api/v2
 * Docs: https://github.com/Seunope/aloc-endpoints/wiki/API-Parameters
 *
 * Auth: AccessToken header (e.g. ALOC-xxxx or QB-xxxx from .env)
 *
 * IMPORTANT: no regex lookbehind anywhere in this file. It is bundled for the browser
 * (the exam page imports it) and iPhones older than iOS 16.4 refuse to parse a script
 * that contains one.
 */

import { convertSupSub, decodeEntities, formatExplanationText, htmlToExplanationText } from "./explanation";

const ALOC_BASE = process.env.ALOC_BASE_URL?.trim() || "https://questions.aloc.com.ng/api/v2";
/** Where relative image paths from ALOC (e.g. "images/bio/cell.png") are served from */
const ALOC_ASSET_BASE = (process.env.ALOC_ASSET_BASE?.trim() || "https://questions.aloc.com.ng/").replace(/\/?$/, "/");

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
  /** English only: true when the question belongs to a comprehension/cloze passage held in `section` */
  hasPassage?: boolean | number | string | null;
  /** English only: the question's number inside its original paper (orders questions within a passage) */
  questionNub?: string | number | null;
  /** English only: ALOC's own category label */
  category?: string | null;
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
  /** True when ALOC flags this English question as part of a passage (comprehension / cloze) */
  hasPassage?: boolean;
  /** Stable id shared by every question that belongs to the same passage text */
  passageId?: string | null;
  /** 1-based order of the passage inside an assembled paper (set by buildEnglishPaper) */
  passageNo?: number | null;
  /** Question number inside its original paper (orders questions within a passage) */
  questionNub?: number | null;
  /** ALOC's category label for English questions */
  category?: string | null;
  /** The exam body this question actually came from (e.g. utme, wassce) */
  examtype?: string | null;
  /** First question image (kept for older saved attempts) */
  image?: string | null;
  /** Every image belonging to the question: the `image` field plus <img> tags inside the question HTML */
  images?: string[];
  /** Image for each option (aligned with `options`), for diagram-style answer choices */
  optionImages?: (string | null)[];
  /** Images that belong to the passage / instruction text */
  sectionImages?: string[];
  /** Images inside the explanation / solution */
  explanationImages?: string[];
  year?: string | null;
  subject?: string | null;
  /** Where the question came from: the ALOC API, or the app's own bundled dataset (set-text questions) */
  source?: "aloc" | "local-novel";
};

export type RichSegment = { text: string; italic?: boolean; bold?: boolean };

function unescapeEntities(input: string): string {
  // Full entity table (&times; &divide; &sup2; &deg; &pi; … plus numeric ones): the old version threw
  // every unknown entity away, so "2 &times; 3" became "2  3" in Maths/Physics questions.
  return decodeEntities(input);
}

/** Coerce whatever ALOC sent for a text field (string, number, null, object) into a string. */
function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function unique<T>(list: T[]): T[] {
  return Array.from(new Set(list));
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

  // <sup>2</sup> / <sub>2</sub> → ² / ₂ so "x<sup>2</sup>" stays x², not "x2"
  const tags = convertSupSub(input).split(/(<[^>]+>)/);
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
  // Nothing survived (e.g. the whole string was an <img> tag): return "", never the raw markup
  return parts.length > 0 ? parts : [{ text: unescapeEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() }];
}

// ─── Images ──────────────────────────────────────────────────────────────────
const IMAGE_EXT = /\.(?:png|jpe?g|jfif|gif|webp|svg|bmp|avif|tiff?)(?:[?#].*)?$/i;
const IMAGE_EXT_LIST = "png|jpe?g|jfif|gif|webp|svg|bmp|avif|tiff?";

/** Magic prefixes of base64-encoded image files that arrive without a "data:" header */
const RAW_BASE64_IMAGE: { re: RegExp; mime: string }[] = [
  { re: /^iVBORw0KGgo/, mime: "image/png" },
  { re: /^\/9j\//, mime: "image/jpeg" },
  { re: /^R0lGOD[la]/, mime: "image/gif" },
  { re: /^UklGR/, mime: "image/webp" },
  { re: /^PHN2Zy|^PD94bWw/, mime: "image/svg+xml" },
];

/** decodeURI/encodeURI THROW on malformed input ("100%.png", lone surrogates) — one bad file name must not fail a whole question set. */
function safeDecodeURI(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}
function safeEncodeURI(s: string): string {
  try {
    return encodeURI(s);
  } catch {
    return s.replace(/ /g, "%20");
  }
}

function rawBase64Image(value: string): { mime: string; data: string } | null {
  const data = value.replace(/\s+/g, "");
  if (data.length < 80 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const hit = RAW_BASE64_IMAGE.find(({ re }) => re.test(data));
  return hit ? { mime: hit.mime, data } : null;
}

/** Inline <svg>…</svg> markup → a data: URI an <img> can show. */
function svgToDataUri(svg: string): string | null {
  let s = svg.trim();
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return null;
  if (s.length > 400_000) return null;
  const openTag = s.slice(0, s.indexOf(">") + 1);
  // A standalone SVG image needs its namespace; inline SVG in HTML usually omits it
  if (!/\bxmlns\s*=/i.test(openTag)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
}

/** Inline SVG diagrams embedded in question / option / passage HTML. */
export function extractInlineSvgs(html: string | null | undefined): string[] {
  if (!html || !/<svg\b/i.test(html)) return [];
  const out: string[] = [];
  const re = /<svg\b[\s\S]*?<\/svg>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const uri = svgToDataUri(m[0]);
    if (uri) out.push(uri);
  }
  return out;
}

/** Remove inline SVG blocks so their <text> labels do not leak into the question wording. */
function stripInlineSvgs(html: string): string {
  return /<svg\b/i.test(html) ? html.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ") : html;
}

/**
 * Turn whatever ALOC stored into a URL a browser can load:
 * absolute https, http (upgraded — the app is served over https), protocol-relative,
 * data: URIs (with or without the "data:" header), inline SVG, bare hosts, or a
 * relative path resolved against the ALOC asset host. Never throws.
 */
export function resolveImageUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let v = unescapeEntities(String(raw))
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, "")
    .trim();
  v = v.replace(/\\\//g, "/"); // JSON-escaped slashes: https:\/\/host\/a.png
  if (!v || /^(?:null|undefined|0|false|none|n\/a)$/i.test(v)) return null;

  if (/^<svg[\s>]/i.test(v)) return svgToDataUri(v);

  if (/^data:image\//i.test(v)) {
    if (/;base64,/i.test(v)) return v.replace(/\s+/g, ""); // wrapped base64
    const comma = v.indexOf(",");
    if (comma < 0) return null;
    let payload = v.slice(comma + 1);
    try {
      payload = decodeURIComponent(payload);
    } catch {
      /* already raw text */
    }
    return `${v.slice(0, comma + 1)}${encodeURIComponent(payload)}`;
  }
  if (/^(?:javascript|vbscript|file):/i.test(v)) return null;

  const b64 = rawBase64Image(v);
  if (b64) return `data:${b64.mime};base64,${b64.data}`;

  const toUrl = (candidate: string): string => {
    try {
      return new URL(candidate).href; // percent-encodes spaces / non-ASCII safely
    } catch {
      return candidate.replace(/ /g, "%20");
    }
  };

  if (v.startsWith("//")) return toUrl(`https:${v}`);
  if (/^http:\/\//i.test(v)) return toUrl(v.replace(/^http:/i, "https:"));
  if (/^https:\/\//i.test(v)) return toUrl(v);
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // some other scheme

  // "upload.wikimedia.org/wikipedia/commons/a/ab/Cell.png" — a host written without its scheme
  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|edu|gov|ng|io|co|uk|info|app|me|ac|biz|us)\/\S+/i.test(v)) {
    return toUrl(`https://${v}`);
  }

  v = v.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!IMAGE_EXT.test(v) && !v.includes("/")) return null;
  return `${ALOC_ASSET_BASE}${v.split("/").map((seg) => safeEncodeURI(safeDecodeURI(seg))).join("/")}`;
}

/** First usable candidate of an <img> tag: src, then the lazy-load / srcset variants. */
function imgTagSource(tag: string): string | null {
  const attr = (name: string): string | undefined => {
    // (^|boundary) instead of a lookbehind so "data-src" is never mistaken for "src"
    const m = tag.match(new RegExp(`(?:^|[\\s"'/])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  };
  const srcset = attr("srcset");
  const candidates = [
    attr("src"),
    attr("data-src"),
    attr("data-original"),
    attr("data-lazy-src"),
    srcset ? srcset.trim().split(/\s+/)[0] : undefined,
  ];
  for (const c of candidates) {
    if (!c) continue;
    // 1×1 lazy-load placeholders are not the picture
    if (/^data:image\//i.test(c) && c.length < 200) continue;
    const url = resolveImageUrl(c);
    if (url) return url;
  }
  return null;
}

/** <img src=…> sources inside an HTML string (question / option / passage / solution text) */
export function extractImgTagSources(html: string | null | undefined): string[] {
  if (!html) return [];
  let source = String(html);
  // Markup that arrived HTML-escaped: &lt;img src=&quot;…&quot;&gt;
  if (/&lt;\s*img\b|&#0*60;\s*img\b/i.test(source)) source = unescapeEntities(source);
  const out: string[] = [];
  const tagRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(source)) !== null) {
    const url = imgTagSource(m[0]);
    if (url) out.push(url);
  }
  return unique(out);
}

function looksLikeImageRef(s: string): boolean {
  return /^(?:https?:)?\/\//i.test(s) || /^data:image\//i.test(s) || IMAGE_EXT.test(s) || rawBase64Image(s) !== null;
}

/**
 * Split a loose "image" column into individual references WITHOUT breaking a single URL
 * that happens to contain a comma, semicolon, pipe or space (the old splitter cut those apart
 * and produced a wrong, unloadable path).
 */
function splitImageRefs(text: string): string[] {
  const out: string[] = [];
  const boundary = /[\s,;|]+(?=(?:https?:)?\/\/|data:image\/)/gi;
  const pieces = text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.trim().split(boundary));
  for (const raw of pieces) {
    const p = raw.trim();
    if (!p) continue;
    if (/^(?:https?:)?\/\//i.test(p) || /^data:image\//i.test(p) || rawBase64Image(p)) {
      out.push(p); // one absolute reference — internal spaces/commas belong to it
    } else {
      out.push(
        ...p
          .replace(new RegExp(`(\\.(?:${IMAGE_EXT_LIST}))\\s*,\\s*(?=\\S)`, "gi"), "$1\n")
          .split(/\s*[;|\n]\s*/),
      );
    }
  }
  return out.map((s) => s.trim()).filter((s) => s && looksLikeImageRef(s));
}

/**
 * The dedicated `image` column is loose: a URL, a relative path, an <img> tag, inline SVG,
 * a base64 string, several references separated by commas/spaces/newlines, a JSON array,
 * or an object with a url/src. Returns every picture it can find.
 */
export function extractImageField(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return unique(value.flatMap((item) => extractImageField(item)));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return extractImageField(o.url ?? o.src ?? o.href ?? o.path ?? o.image ?? o.file ?? null);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  const found: string[] = [...extractImgTagSources(trimmed), ...extractInlineSvgs(trimmed)];
  const withoutMarkup = stripInlineSvgs(trimmed).replace(/<[^>]+>/g, " ").trim();
  if (!withoutMarkup) return unique(found);

  if (/^[[{]/.test(withoutMarkup)) {
    try {
      const parsed: unknown = JSON.parse(withoutMarkup);
      return unique([...found, ...extractImageField(parsed)]);
    } catch {
      /* not JSON — fall through to the plain-text splitter */
    }
  }
  for (const ref of splitImageRefs(withoutMarkup)) {
    const url = resolveImageUrl(ref);
    if (url) found.push(url);
  }
  return unique(found);
}

/** Column names different ALOC exports use for a question's picture(s). */
const IMAGE_FIELD_KEYS = ["image", "images", "img", "picture", "figure", "diagram", "image_url", "imageUrl", "image_path", "imagePath", "photo"];

function gatherImageFields(q: AlocQuestion): string[] {
  const rec = q as unknown as Record<string, unknown>;
  return unique(IMAGE_FIELD_KEYS.flatMap((key) => extractImageField(rec[key])));
}

/**
 * Like stripHtml but keeps paragraph / line breaks. Comprehension passages
 * are long; flattening them into one block is unreadable.
 */
export function htmlToParagraphs(input: string): string {
  const withBreaks = convertSupSub(input)
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(?:div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return unescapeEntities(withBreaks)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tiny stable hash so questions sharing one passage text share one passageId */
function hashText(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
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

const NOVEL_TITLE_PATTERNS: { kind: "known" | "quoted" | "run"; re: RegExp }[] = [
  // Explicit known JAMB/UTME set texts — cleanest signal, tried first
  { kind: "known", re: /\b(The Lekki Headmaster|The Life Changer|Sweet Sixteen|The Last Days at Forcados High(?: School)?|The Successors|Independence|Nineteen Eighty-?Four|The Joys of Motherhood|Harvest of Corruption|Sons and Daughters|The Tempest|Romeo and Juliet|Hamlet|Macbeth|Ambush|The Proud King|The Anvil and the Hammer)\b/i },
  // Title in quotes: "based on Bolaji Abdullahi's 'Sweet Sixteen'"
  { kind: "quoted", re: /(?:based on|drawn from|from the novel|extracted from|extract for question(?:s)?(?: is)?(?: taken)? from)[^:\n]*?["“‘']([^"”’']{3,80})["”’']/i },
  // Run of 2+ capitalized words after "based on/drawn from", e.g. "based on George Orwell's Nineteen Eighty-Four"
  { kind: "run", re: /(?:based on|drawn from|from)\s+([A-Z][\w'’.\-]+(?:\s+[A-Z][\w'’.\-]+){1,5})/ },
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
        .replace(/^[“‘"']|[”’"'.,\s]+$/g, "")
        .replace(/\s*[’']s$/i, "") // trailing possessive → author, not title
        .replace(/^[\w.\s]+[’']s\s+(?=[A-Z])/, "") // author prefix: "Bolaji Abdullahi's X"
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

// ─── Options + answer ────────────────────────────────────────────────────────
type ResolvedOption = {
  /** The option's original ALOC letter (a–e), kept so the answer maps correctly even if a middle option was blank */
  key: string;
  text: string;
  segments: RichSegment[] | null;
  image: string | null;
};

const OPTION_KEYS = ["a", "b", "c", "d", "e"];

function resolveOptions(q: AlocQuestion): ResolvedOption[] {
  const fromRaw = (key: string, opt: unknown): ResolvedOption | null => {
    const rawText = asText(opt);
    if (rawText.trim().length === 0) return null;
    const html = stripInlineSvgs(rawText);
    let image: string | null = extractImgTagSources(rawText)[0] ?? extractInlineSvgs(rawText)[0] ?? null;
    const segments = htmlToSegments(html);
    let text = segments.map((s) => s.text).join("").trim();
    // Option stored as a bare URL / file name / base64 → it is a picture, not text
    if (!image && text && !/\s/.test(text) && (/^(?:https?:)?\/\/\S+$/i.test(text) || IMAGE_EXT.test(text) || rawBase64Image(text))) {
      const asUrl = resolveImageUrl(text);
      if (asUrl) {
        image = asUrl;
        text = "";
      }
    }
    const hasRich = !!text && segments.some((s) => s.italic || s.bold);
    // An option that is only a picture (e.g. Biology "which diagram shows …") is still a real option
    if (!text && !image) return null;
    return { key, text, segments: hasRich ? segments : null, image };
  };

  if (Array.isArray(q.options)) {
    return q.options
      .map((opt, i) => fromRaw(OPTION_KEYS[i] ?? String(i), opt))
      .filter((o): o is ResolvedOption => o !== null);
  }
  const optObj = q.option ?? (q.options && typeof q.options === "object" ? q.options : null);
  if (!optObj || typeof optObj !== "object") return [];

  // keys can come as a/A or " a "
  const lowered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(optObj as Record<string, unknown>)) lowered[k.trim().toLowerCase()] = v;

  const list: ResolvedOption[] = [];
  for (const k of OPTION_KEYS) {
    const o = fromRaw(k, lowered[k]);
    if (o) list.push(o);
  }
  return list;
}

/**
 * Which option is correct, as an index into the (possibly compacted) option list.
 * Returns -1 when the answer cannot be resolved — such a question cannot be graded,
 * so it is dropped instead of silently becoming "A" (which marked students wrong).
 */
function resolveAnswerIndex(answer: unknown, options: ResolvedOption[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (typeof answer === "number") {
    return Number.isInteger(answer) && answer >= 0 && answer < options.length ? answer : -1;
  }
  if (typeof answer !== "string") return -1;
  const trimmed = answer.trim();
  if (!trimmed) return -1;

  const letter = trimmed.toLowerCase().match(/^\(?\s*([a-e])\s*\)?\s*[.):-]?\s*$/);
  if (letter) return options.findIndex((o) => o.key === letter[1]);

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return n >= 0 && n < options.length ? n : -1;
  }
  // Answer given as the option's own text
  const t = norm(trimmed);
  return t ? options.findIndex((o) => norm(o.text) === t) : -1;
}

/**
 * Make a raw ALOC record safe to normalise: parse records / option maps that arrive as JSON
 * strings and coerce the text fields. Returns null for anything that is not a question object.
 */
export function hydrateAlocQuestion(input: unknown): AlocQuestion | null {
  let q: unknown = input;
  if (typeof q === "string") {
    try {
      q = JSON.parse(q);
    } catch {
      return null;
    }
  }
  if (!q || typeof q !== "object" || Array.isArray(q)) return null;
  const rec = { ...(q as Record<string, unknown>) };
  for (const key of ["option", "options"]) {
    const v = rec[key];
    if (typeof v === "string" && /^\s*[[{]/.test(v)) {
      try {
        rec[key] = JSON.parse(v);
      } catch {
        /* leave as is */
      }
    }
  }
  for (const key of ["question", "section", "solution", "explanation"]) {
    if (key in rec) rec[key] = asText(rec[key]);
  }
  return rec as unknown as AlocQuestion;
}

export function normalizeAlocQuestion(q: AlocQuestion, defaultSubject?: string): NormalizedQuestion | null {
  try {
    return normalizeAlocQuestionUnsafe(q, defaultSubject);
  } catch (err) {
    // One malformed record must never take a whole question set down with it
    console.warn("Skipped a malformed ALOC question:", err instanceof Error ? err.message : err);
    return null;
  }
}

function normalizeAlocQuestionUnsafe(q: AlocQuestion, defaultSubject?: string): NormalizedQuestion | null {
  if (!q) return null;
  const questionHtml = asText(q.question);
  const sectionHtml = asText(q.section);
  const solutionHtml = asText(q.solution) || asText(q.explanation);

  // Some ALOC questions (e.g. stress-pattern) put the actual prompt in `section`
  // and leave `question` empty. Fall back to section when that happens.
  const hasPassage = q.hasPassage === true || q.hasPassage === 1 || q.hasPassage === "1" || q.hasPassage === "true";
  const rawPrompt = stripHtml(stripInlineSvgs(questionHtml));
  const flatSection = stripHtml(stripInlineSvgs(sectionHtml));
  // Passages keep their paragraph breaks; short instructions stay single-line
  const rawSection = hasPassage || flatSection.length >= 400 ? htmlToParagraphs(stripInlineSvgs(sectionHtml)) : flatSection;
  const nubParsed = q.questionNub != null ? parseInt(String(q.questionNub), 10) : NaN;
  const questionNub = Number.isNaN(nubParsed) ? null : nubParsed;
  // Passage questions with an empty `question` (e.g. cloze gaps) must not show the
  // whole passage as their prompt — keep the passage in `section` and ask a real prompt.
  const passagePromptFallback =
    hasPassage && !rawPrompt && rawSection
      ? questionNub != null
        ? `Choose the option that best fills gap ${questionNub}.`
        : "Choose the best option based on the passage."
      : "";
  // Images: the image column(s) AND any <img> tags / inline SVG hiding in the question HTML
  // (the text cleaner strips tags, so without this a diagram inside the question simply vanished)
  const questionImages = unique([
    ...gatherImageFields(q),
    ...extractImgTagSources(questionHtml),
    ...extractInlineSvgs(questionHtml),
  ]);
  const imagePromptFallback = !rawPrompt && !passagePromptFallback && questionImages.length > 0 ? "Study the image and choose the correct answer." : "";
  const prompt = rawPrompt || passagePromptFallback || imagePromptFallback || rawSection;
  const resolved = resolveOptions(q);
  const options = resolved.map((o) => o.text);
  if (!prompt || options.length < 2) return null;

  // Keep italics/bold when present (English lexis questions mark keywords)
  const rawPromptSegments = htmlToSegments(stripInlineSvgs(questionHtml));
  const promptSegments = rawPromptSegments.some((s) => s.italic || s.bold) ? rawPromptSegments : null;
  const optionSegments = resolved.map((o) => o.segments);

  const answerIdx = resolveAnswerIndex(q.answer, resolved);
  if (answerIdx < 0 || answerIdx >= options.length) return null;

  const rawSolution = solutionHtml;
  // Keep the working readable: line breaks kept, ² ₂ × ÷ ° decoded, steps split onto their own lines
  const explanationSubject = q.subject ? slugToName(q.subject) : defaultSubject ?? null;
  const explanationText = rawSolution ? formatExplanationText(htmlToExplanationText(String(rawSolution)), explanationSubject) : "";
  const explanation = explanationText || null;
  // Only include section as a separate field if it wasn't already used as the prompt
  const section = rawSection && rawSection !== prompt ? rawSection : null;
  const sectionKind = section ? (hasPassage ? "passage" : classifySection(section)) : null;
  const passageId = sectionKind === "passage" && section ? `p${hashText(section.toLowerCase().replace(/[^a-z0-9]/g, ""))}` : null;
  const image = questionImages[0] ?? null;
  const sectionImages = unique([...extractImgTagSources(sectionHtml), ...extractInlineSvgs(sectionHtml)]);
  const explanationImages = unique([...extractImgTagSources(solutionHtml), ...extractInlineSvgs(solutionHtml)]);
  const optionImages = resolved.map((o) => o.image);
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
    section: section || null,
    sectionKind,
    hasPassage,
    passageId,
    questionNub,
    category: typeof q.category === "string" && q.category.trim() ? q.category.trim() : null,
    novel,
    examtype: typeof q.examtype === "string" ? q.examtype : null,
    image,
    images: questionImages,
    optionImages: optionImages.some(Boolean) ? optionImages : undefined,
    sectionImages: sectionImages.length ? sectionImages : undefined,
    explanationImages: explanationImages.length ? explanationImages : undefined,
    year,
    subject,
    source: "aloc",
  };
}

/** Keys that identify "the same question" even when ALOC repeats it under a different id. */
export function questionDedupeKeys(q: Pick<NormalizedQuestion, "id" | "prompt" | "options" | "section">): string[] {
  const text = `${q.section ? q.section.slice(0, 80) : ""}|${q.prompt.toLowerCase().replace(/\s+/g, " ")}|${q.options.join("|").toLowerCase()}`;
  return [`id:${q.id}`, `t:${hashText(text)}`];
}

/**
 * Hydrate + normalise + de-duplicate a raw ALOC list. Questions that cannot be shown
 * (no prompt, fewer than two options, no resolvable answer, duplicates) are counted in
 * `dropped` so callers can top the set up instead of silently shipping a short paper.
 */
export function normalizeAlocList(raw: unknown[], defaultSubject?: string): { questions: NormalizedQuestion[]; dropped: number } {
  const out: NormalizedQuestion[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const item of raw) {
    const hydrated = hydrateAlocQuestion(item);
    const normalized = hydrated ? normalizeAlocQuestion(hydrated, defaultSubject) : null;
    if (!normalized) {
      dropped += 1;
      continue;
    }
    const keys = questionDedupeKeys(normalized);
    if (keys.some((k) => seen.has(k))) {
      dropped += 1;
      continue;
    }
    keys.forEach((k) => seen.add(k));
    out.push(normalized);
  }
  return { questions: out, dropped };
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

class AlocHttpError extends Error {
  constructor(message: string, readonly transient: boolean) {
    super(message);
    this.name = "AlocHttpError";
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GET + parse an ALOC endpoint. Network blips, timeouts, HTTP 429 and 5xx are retried once
 * (a single hiccup used to fail the whole exam start); client errors (401/403/404) are not.
 */
async function alocGetJson(url: string, apiKey: string, opts: { timeoutMs?: number; retries?: number } = {}): Promise<AlocResponse> {
  const timeoutMs = opts.timeoutMs ?? 12000;
  const retries = opts.retries ?? 1;
  let last: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: alocHeaders(apiKey),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        throw new AlocHttpError(`ALOC API returned HTTP ${res.status}`, res.status === 429 || res.status >= 500);
      }
      const text = await res.text();
      try {
        return JSON.parse(text) as AlocResponse;
      } catch {
        throw new AlocHttpError("ALOC API returned an unreadable response", true);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      last = e.name === "TimeoutError" || e.name === "AbortError" ? new AlocHttpError("ALOC took too long to respond", true) : e;
      const transient = last instanceof AlocHttpError ? last.transient : true; // network failures are transient
      if (!transient || attempt === retries) break;
      await sleep(400 * (attempt + 1));
    }
  }
  throw last ?? new Error("ALOC request failed");
}

/** The question records inside an ALOC payload (array, single object, or nested). */
function rawQuestionList(json: AlocResponse | null | undefined): unknown[] {
  const data = json?.data as unknown;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const nested = (data as { questions?: unknown; data?: unknown }).questions ?? (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested;
    return [data];
  }
  return [];
}

type CountOptions = { year?: string; type?: string };

/**
 * Collect `want` unique, displayable questions. ALOC returns ~40 per call and may repeat
 * questions or send some we cannot show, so a single call routinely came back short.
 * We keep topping up (a few rounds, stopping as soon as a round adds nothing new).
 * `first` is the URL of the opening request; later rounds use /m/{n} (falling back to /q/{n}).
 */
async function collectQuestions(
  apiKey: string,
  slug: string,
  want: number,
  params: URLSearchParams,
  first: string | null,
): Promise<NormalizedQuestion[]> {
  const subjectName = slugToName(slug);
  const got = new Map<string, NormalizedQuestion>();
  const seen = new Set<string>();
  let stagnant = 0;
  let firstError: Error | null = null;

  for (let round = 0; round < 5 && got.size < want; round++) {
    const remaining = want - got.size;
    const urls =
      round === 0 && first
        ? [first]
        : [
            `${ALOC_BASE}/m/${Math.min(120, Math.max(remaining + 5, 10))}?${params.toString()}`,
            `${ALOC_BASE}/q/${Math.min(40, Math.max(remaining + 5, 10))}?${params.toString()}`,
          ];
    let list: unknown[] | null = null;
    for (const url of urls) {
      try {
        list = rawQuestionList(await alocGetJson(url, apiKey));
        break;
      } catch (err) {
        firstError = firstError ?? (err instanceof Error ? err : new Error(String(err)));
      }
    }
    if (list === null) break;

    const { questions } = normalizeAlocList(list, subjectName);
    let added = 0;
    for (const q of questions) {
      const keys = questionDedupeKeys(q);
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      got.set(q.id, q);
      added += 1;
      if (got.size >= want) break;
    }
    stagnant = added === 0 ? stagnant + 1 : 0;
    if (stagnant >= 2) break;
  }

  if (got.size === 0 && firstError) throw firstError;
  return Array.from(got.values()).slice(0, want);
}

/**
 * Fetch a specific count of questions.
 * Uses /q/{count} for up to 40, then tops the set up so `count` complete questions come back
 * whenever ALOC has that many (the old version returned a single /m page — about 40 — for any larger ask).
 */
export async function fetchAlocQuestionCount(
  apiKey: string,
  subject: string,
  count: number,
  opts: CountOptions = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const want = Math.min(Math.max(Math.floor(count) || 1, 1), 200);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years") params.set("year", opts.year);
  if (opts.type) params.set("type", opts.type);

  const first = want <= 40 ? `${ALOC_BASE}/q/${want}?${params.toString()}` : `${ALOC_BASE}/m?${params.toString()}`;
  return collectQuestions(apiKey, slug, want, params, first);
}

/**
 * Fetch bulk questions for a subject (default ~40).
 * Uses the /m endpoint. Pass `count` to ask for more (the set is topped up to that size).
 */
export async function fetchAlocQuestions(
  apiKey: string,
  subject: string,
  opts: CountOptions & { count?: number } = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years") params.set("year", opts.year);
  if (opts.type && opts.type !== "utme") params.set("type", opts.type);

  const want = opts.count && opts.count > 0 ? Math.min(Math.floor(opts.count), 200) : 40;
  return collectQuestions(apiKey, slug, want, params, `${ALOC_BASE}/m?${params.toString()}`);
}


/**
 * Fetch up to `limit` (max 120) random questions via /m/{limit}.
 * `withComprehension` matters for English: ALOC silently DROPS every passage
 * (comprehension / cloze) question unless withComprehension=true is sent, which
 * is why passages never showed up when we only called /m or /q/{n}.
 */
export async function fetchAlocMany(
  apiKey: string,
  subject: string,
  limit: number,
  opts: { year?: string; type?: string; withComprehension?: boolean } = {},
): Promise<NormalizedQuestion[]> {
  const slug = nameToSlug(subject);
  const params = new URLSearchParams({ subject: slug });
  if (opts.year && opts.year !== "All years" && opts.year !== "random") params.set("year", opts.year);
  if (opts.type) params.set("type", opts.type);
  if (opts.withComprehension) params.set("withComprehension", "true");
  const clamped = Math.min(Math.max(Math.floor(limit), 1), 120);

  const json = await alocGetJson(`${ALOC_BASE}/m/${clamped}?${params.toString()}`, apiKey, { timeoutMs: 15000 });
  return normalizeAlocList(rawQuestionList(json), slugToName(slug)).questions;
}

let comprehensionYearsCache: { at: number; years: string[] } | null = null;

/** Years for which ALOC has English comprehension passages (cached for an hour). */
export async function fetchAlocComprehensionYears(apiKey: string): Promise<string[]> {
  if (comprehensionYearsCache && Date.now() - comprehensionYearsCache.at < 60 * 60 * 1000) {
    return comprehensionYearsCache.years;
  }
  const res = await fetch(`${ALOC_BASE}/q-comprehension-years?subject=english`, {
    headers: alocHeaders(apiKey),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ALOC API returned HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { examyear?: string | number }[] };
  const years = (Array.isArray(json.data) ? json.data : [])
    .map((r) => (r?.examyear != null ? String(r.examyear).trim() : ""))
    .filter((y) => /^\d{4}$/.test(y));
  const uniqueYears = Array.from(new Set(years));
  if (uniqueYears.length > 0) comprehensionYearsCache = { at: Date.now(), years: uniqueYears };
  return uniqueYears;
}
