/**
 * Automatic backup of finished exams.
 *
 * A result is always stored on the device first (so it works with no signal). This scheduler then copies it to the
 * student's account on its own: a moment after the exam is submitted, again when the phone gets signal back, and
 * when the app is reopened. It never shows a message and never blocks the student.
 *
 * Rules that keep it safe:
 *  • one backup at a time — a "kick" while one is running is remembered and re-checked afterwards;
 *  • a failed backup waits 15 s, 30 s, 1 min … (max 10 min) before trying again, so a bad connection or a server
 *    problem cannot cause a retry storm; going back online resets the wait;
 *  • nothing is sent when nothing is waiting.
 * The pure logic lives here (timers and I/O are injected) so it can be tested without a browser.
 */

export type AutoBackupDeps = {
  /** How many finished results / deletions are still only on this device */
  pendingCount: () => Promise<number>;
  /** Run one backup. Resolves true when everything went through. Must not throw (a throw counts as a failure). */
  backup: () => Promise<boolean>;
  isOnline: () => boolean;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
};

export type AutoBackup = {
  /** Something may have changed (exam submitted, signal back, app opened). Cheap to call often. */
  kick: (opts?: { resetBackoff?: boolean }) => void;
  stop: () => void;
};

export const FIRST_DELAY_MS = 1200;
/** Minimum time between two checks, so storage writes during an exam (autosave) cannot cause constant checking */
export const MIN_GAP_MS = 4000;
export const BACKOFF_START_MS = 15_000;
export const BACKOFF_MAX_MS = 10 * 60_000;

export function createAutoBackup(deps: AutoBackupDeps): AutoBackup {
  const now = deps.now ?? (() => Date.now());
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let timer: unknown = null;
  let timerAt = 0;
  let running = false;
  let again = false;
  let stopped = false;
  let failures = 0;
  let notBefore = 0; // earliest time the next attempt is allowed
  let lastRunAt = -Infinity;

  function schedule(delay: number) {
    const at = now() + delay;
    if (timer !== null) {
      if (timerAt <= at) return; // an earlier run is already queued
      clearTimer(timer);
    }
    timerAt = at;
    timer = setTimer(() => {
      timer = null;
      void run();
    }, delay);
  }

  async function run() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    if (!deps.isOnline()) return; // the "online" event kicks us again
    const wait = notBefore - now();
    if (wait > 0) return schedule(wait);

    running = true;
    lastRunAt = now();
    try {
      let pending = 0;
      try {
        pending = await deps.pendingCount();
      } catch {
        return;
      }
      if (pending <= 0) {
        failures = 0;
        return;
      }
      let ok = false;
      try {
        ok = await deps.backup();
      } catch {
        ok = false;
      }
      if (ok) {
        failures = 0;
        notBefore = 0;
      } else {
        failures += 1;
        const back = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** (failures - 1));
        notBefore = now() + back;
        if (!stopped) schedule(back);
      }
    } finally {
      running = false;
      if (again && !stopped) {
        again = false;
        schedule(Math.max(FIRST_DELAY_MS, lastRunAt + MIN_GAP_MS - now()));
      }
    }
  }

  return {
    kick(opts) {
      if (stopped) return;
      if (opts?.resetBackoff) {
        failures = 0;
        notBefore = 0;
      }
      if (running) {
        again = true;
        return;
      }
      schedule(Math.max(FIRST_DELAY_MS, notBefore - now(), lastRunAt + MIN_GAP_MS - now()));
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
}
