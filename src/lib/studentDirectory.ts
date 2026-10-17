/**
 * Student directory rules (Messages → Students). Pure functions, no React and no network, so they are unit-tested.
 *
 *  - who shows first: classmates aiming for the same course, then students sharing your subjects, then people who are
 *    online right now, then everyone else A–Z
 *  - search: every word typed must match the name, the course or one of the subjects (so "ada medicine" works)
 *  - filters: Online now, Same course as me, and the most common courses
 *  - the list is shown a page at a time so a big school does not become one endless scroll
 */

export type Student = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  course?: string | null;
  interests?: string[] | null;
  streak_days?: number | null;
};

export type StudentFilter = {
  query: string;
  online: boolean;
  sameCourse: boolean;
  /** A course picked from the chips (matched case-insensitively). Empty = any. */
  course: string;
};

export const NO_FILTER: StudentFilter = { query: "", online: false, sameCourse: false, course: "" };
export const PAGE_SIZE = 24;
/** The directory is fetched most-recently-active first and capped; the name search reaches everyone else. */
export const DIRECTORY_FETCH_LIMIT = 300;
export const REMOTE_SEARCH_MIN_CHARS = 2;
export const REMOTE_SEARCH_LIMIT = 30;

/** Lower-case, trimmed, single-spaced — so "  Medicine  " and "medicine" are the same course. */
export function norm(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** "Medicine" and "Medicine and Surgery" count as the same aim; very short strings never do. */
export function sameCourse(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 2 || y.length < 2) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && (long === short || long.startsWith(short + " "));
}

/** Subjects both of you study (case-insensitive), in the other student's spelling. */
export function sharedSubjects(me: Student | null, other: Student): string[] {
  if (!me) return [];
  const mine = new Set((me.interests ?? []).map(norm));
  return (other.interests ?? []).filter((s) => mine.has(norm(s)));
}

/** How much two students have in common (higher = closer). Same course is worth more than a shared subject. */
export function affinity(me: Student | null, other: Student): number {
  if (!me) return 0;
  return (sameCourse(me.course, other.course) ? 5 : 0) + sharedSubjects(me, other).length * 2;
}

/** Best match first; ties go to people who are online, then A–Z. Does not change the list it is given. */
export function rankStudents(list: readonly Student[], me: Student | null, online: ReadonlySet<string>): Student[] {
  const scored = list.map((s) => ({ s, a: affinity(me, s), on: online.has(s.id) ? 1 : 0 }));
  scored.sort((p, q) => q.a - p.a || q.on - p.on || p.s.full_name.localeCompare(q.s.full_name, undefined, { sensitivity: "base" }));
  return scored.map((x) => x.s);
}

function haystack(s: Student): string {
  return norm([s.full_name, s.course ?? "", ...(s.interests ?? [])].join(" "));
}

/** Every typed word must appear somewhere in the name, course or subjects. */
export function matchesQuery(s: Student, query: string): boolean {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const hay = haystack(s);
  return words.every((w) => hay.includes(w));
}

export function filterStudents(
  list: readonly Student[],
  filter: StudentFilter,
  me: Student | null,
  online: ReadonlySet<string>,
): Student[] {
  const course = norm(filter.course);
  return list.filter((s) => {
    if (filter.online && !online.has(s.id)) return false;
    if (filter.sameCourse && !sameCourse(me?.course, s.course)) return false;
    if (course && norm(s.course) !== course) return false;
    return matchesQuery(s, filter.query);
  });
}

export function isFiltering(f: StudentFilter): boolean {
  return f.query.trim() !== "" || f.online || f.sameCourse || norm(f.course) !== "";
}

export type CourseChip = { key: string; label: string; count: number };

/** The most common courses, grouped without caring about capital letters ("medicine" + "Medicine" = one chip). */
export function courseChips(list: readonly Student[], limit = 6): CourseChip[] {
  const groups = new Map<string, { spellings: Map<string, number>; count: number }>();
  for (const s of list) {
    const label = (s.course ?? "").trim().replace(/\s+/g, " ");
    const key = norm(label);
    if (key.length < 2) continue;
    const g = groups.get(key) ?? { spellings: new Map(), count: 0 };
    g.count += 1;
    g.spellings.set(label, (g.spellings.get(label) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      count: g.count,
      // show the spelling most students used
      label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Adds `extra` to `base`, skipping anyone already there (the first copy wins). */
export function mergeStudents(base: readonly Student[], extra: readonly Student[]): Student[] {
  const seen = new Set(base.map((s) => s.id));
  const out = [...base];
  for (const s of extra) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

/** Makes typed text safe inside an ILIKE pattern: %, _ and \ are ordinary letters, not wildcards. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Should typing this query go to the server too? Only for name-like text of 2+ characters. */
export function wantsRemoteSearch(query: string): boolean {
  return query.trim().length >= REMOTE_SEARCH_MIN_CHARS;
}

/** First page and the rest: `visible` is how many are on screen. */
export function pageOf<T>(list: readonly T[], visible: number): { shown: T[]; remaining: number } {
  const n = Math.max(0, Math.min(visible, list.length));
  return { shown: list.slice(0, n), remaining: list.length - n };
}

/** Removes the student's own row and anyone I blocked. */
export function withoutHidden<T extends { id: string }>(list: readonly T[], myId: string | null | undefined, blocked: ReadonlySet<string>): T[] {
  return list.filter((s) => s.id !== myId && !blocked.has(s.id));
}
