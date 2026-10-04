/**
 * Which prescribed texts (set books) the CURRENT JAMB/UTME Use of English paper is based on.
 *
 * JAMB prescribes one novel for Use of English: Q51–60 of the 60-question paper are drawn from it.
 * Older prescribed books stay in the app as study notes (see lib/novels.ts) but must never show up
 * in an English mock exam. Change CURRENT_UTME_NOVEL when JAMB announces a new text.
 */
export const CURRENT_UTME_NOVEL = "The Lekki Headmaster";

/** Previously prescribed books. Kept for the study notes; hidden from English mock exams. */
export const ARCHIVED_UTME_NOVELS = [
  "The Life Changer",
  "Sweet Sixteen",
  "The Last Days at Forcados High",
  "The Successors",
  "The Successor",
  "Independence",
] as const;

/** JAMB Use of English: 60 questions, the set text occupies the last block. */
export const ENGLISH_PAPER_TOTAL = 60;
export const NOVEL_QUESTIONS_MIN = 5;
export const NOVEL_QUESTIONS_MAX = 10;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when `title` is (or contains the name of) a previously prescribed book. */
export function isArchivedNovel(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = norm(title);
  if (!t) return false;
  return ARCHIVED_UTME_NOVELS.some((a) => {
    const n = norm(a);
    return t === n || t.includes(n);
  });
}

/** True when `title` is the current prescribed text. */
export function isCurrentNovel(title: string | null | undefined): boolean {
  if (!title) return false;
  const a = norm(title);
  const b = norm(CURRENT_UTME_NOVEL);
  return !!a && (a === b || a.includes(b) || b.includes(a));
}

/** Any mention of an archived book inside free text (a question prompt or passage heading). */
export function mentionsArchivedNovel(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return ["the life changer", "sweet sixteen", "last days at forcados", "the successors"].some((k) => t.includes(k));
}
