/**
 * Rules for the "Update available" card (pure functions, no imports, so `npm test` can check them).
 *
 * How it works: every build of the app carries an id and a build time (next.config.ts). /api/version reports the id and
 * time of the build that is live RIGHT NOW. If a phone is running an older build than the live one, the card offers
 * to reload into the new one. The student can always close it and keep using the app.
 */

export type BuildInfo = { build: string; builtAt: number };
export type VersionResponse = BuildInfo & { notes: string[] };

/** How often an open app asks whether a newer build exists. It also asks when brought back to the front or back online. */
export const CHECK_EVERY_MS = 10 * 60 * 1000;
/** Never ask more often than this, however many times the screen is woken or the signal flickers. */
export const MIN_CHECK_GAP_MS = 30 * 1000;
/** "What's new" notes written by the admin stop showing after this long, so an old note never rides on a later update. */
export const NOTES_FRESH_MS = 21 * 24 * 60 * 60 * 1000;
export const MAX_NOTES = 5;
export const MAX_NOTE_CHARS = 140;
/** Where the admin's notes are kept (admin_settings row). */
export const NOTES_SETTING_KEY = "update_notes";
/** The student pressed "Not now" for this build: stay quiet for the rest of this visit. Next time the app is opened it asks again. */
export const DISMISS_KEY = "qubit_update_dismissed";
/** Set just before reloading so the next screen can say "You're up to date" once. */
export const JUST_UPDATED_KEY = "qubit_just_updated";
export const JUST_UPDATED_WINDOW_MS = 2 * 60 * 1000;

/** The build this copy of the app was made from. null when it is not known (then no card is ever shown). */
export function currentBuild(env: { NEXT_PUBLIC_BUILD_ID?: string; NEXT_PUBLIC_BUILD_TIME?: string }): BuildInfo | null {
  const build = (env.NEXT_PUBLIC_BUILD_ID ?? "").trim();
  const builtAt = Number(env.NEXT_PUBLIC_BUILD_TIME);
  if (!build || !Number.isFinite(builtAt) || builtAt <= 0) return null;
  return { build, builtAt };
}

/** Cleans a "What's new" text into at most MAX_NOTES short lines (leading bullets removed). */
export function parseNotes(text: unknown): string[] {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_NOTES)
    .map((l) => (l.length > MAX_NOTE_CHARS ? `${l.slice(0, MAX_NOTE_CHARS - 1).trimEnd()}…` : l));
}

/** Notes only count while fresh. An unreadable save date counts as stale. */
export function notesAreFresh(updatedAt: string | null | undefined, now: number): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  return Number.isFinite(t) && t <= now + 60_000 && now - t <= NOTES_FRESH_MS;
}

/** Reads the /api/version answer; anything malformed is "no information" (never a card). */
export function parseVersionResponse(raw: unknown): VersionResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { build?: unknown; builtAt?: unknown; notes?: unknown };
  if (typeof r.build !== "string" || !r.build.trim()) return null;
  const builtAt = Number(r.builtAt);
  if (!Number.isFinite(builtAt) || builtAt <= 0) return null;
  const notes = Array.isArray(r.notes)
    ? r.notes.filter((n): n is string => typeof n === "string").slice(0, MAX_NOTES).map((n) => n.slice(0, MAX_NOTE_CHARS))
    : [];
  return { build: r.build.trim(), builtAt, notes };
}

/**
 * Is there a newer build than the one running? Needs both sides known, a different id, AND a later build time: a rollback
 * or a different preview deployment must never be offered as an "update".
 */
export function isUpdateAvailable(current: BuildInfo | null, latest: BuildInfo | null): boolean {
  if (!current || !latest) return false;
  return current.build !== latest.build && latest.builtAt > current.builtAt;
}

/** Ask now? Not more often than MIN_CHECK_GAP_MS, unless forced (first check when the app opens). */
export function shouldCheck(lastCheckAt: number, now: number, force = false): boolean {
  if (force) return true;
  return now - lastCheckAt >= MIN_CHECK_GAP_MS || now < lastCheckAt;
}

/**
 * Screens where a student is in the middle of something timed or live. The card waits until they leave: it is never
 * allowed to pop up over a question or a duel.
 */
export function holdCardOnPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/exam" || p.startsWith("/exam/")) return true;
  if (p.startsWith("/practice/")) return true; // /practice itself is the menu; /practice/<mode> is a running session
  if (p === "/daily-challenge" || p.startsWith("/daily-challenge/")) return true;
  if (p === "/speed-training" || p.startsWith("/speed-training/")) return true;
  if (p === "/arena" || p.startsWith("/arena/")) return true; // lobby and live duel share this screen
  return false;
}

/** Was the last "Update now" recent enough to say "You're up to date" on this screen? */
export function justUpdatedRecently(raw: string | null | undefined, now: number): boolean {
  const t = Number(raw);
  return Number.isFinite(t) && t > 0 && now - t >= 0 && now - t <= JUST_UPDATED_WINDOW_MS;
}
