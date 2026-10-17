"use client";

/**
 * UpdateCard — tells the student a newer version of Qubit Learn has been published, and offers to load it.
 *
 *  - Shown when the app is opened (or brought back to the front) and the copy on the phone is OLDER than the live one.
 *    A phone that already has the newest version never sees it.
 *  - Never traps anyone: "Not now", the ✕, the Esc key and a tap outside all close it and the app works as before.
 *    It asks again the next time the app is opened, not again and again during the same visit.
 *  - Never appears over a mock exam, a practice session, a duel or the daily challenge; it waits until they leave.
 *  - Works offline-first: with no signal the check simply does nothing.
 *  - "Update now" reloads into the new version (nothing the student has saved is touched).
 *
 * The rules live in lib/appUpdate.ts (unit-tested); the live build comes from /api/version.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2, Rocket, X } from "lucide-react";
import {
  CHECK_EVERY_MS, currentBuild, DISMISS_KEY, holdCardOnPath, isUpdateAvailable, JUST_UPDATED_KEY, justUpdatedRecently,
  parseVersionResponse, shouldCheck, type VersionResponse,
} from "@/lib/appUpdate";

// NEXT_PUBLIC_* values are swapped in at build time only when written out like this (see lib/env.ts)
const CURRENT = currentBuild({ NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID, NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME });

function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export default function UpdateCard() {
  const pathname = usePathname();
  const [latest, setLatest] = useState<VersionResponse | null>(null);
  // Which build the student closed the card for, during this visit only
  const [closedFor, setClosedFor] = useState<string | null>(() => (typeof window === "undefined" ? null : readSession(DISMISS_KEY)));
  const [updating, setUpdating] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const lastCheck = useRef(0);
  const inFlight = useRef(false);
  const primary = useRef<HTMLButtonElement>(null);

  const check = useCallback(async (force = false) => {
    if (!CURRENT || inFlight.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const now = Date.now();
    if (!shouldCheck(lastCheck.current, now, force)) return;
    lastCheck.current = now;
    inFlight.current = true;
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch("/api/version", { cache: "no-store", signal: ctl.signal });
      if (!res.ok) return;
      const info = parseVersionResponse(await res.json());
      if (info) setLatest(info);
    } catch {
      // Offline, a slow signal or our server having a moment: stay quiet and try again later
    } finally {
      window.clearTimeout(timer);
      inFlight.current = false;
    }
  }, []);

  // Ask when the app opens, every few minutes while it is open, when it comes back to the front and when the signal returns
  useEffect(() => {
    const first = window.setTimeout(() => void check(true), 0);
    const every = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const onOnline = () => void check(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [check]);

  // Right after "Update now": say once that the new version is running
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(JUST_UPDATED_KEY); } catch { /* storage blocked */ }
    if (raw === null) return;
    const t = window.setTimeout(() => {
      try { localStorage.removeItem(JUST_UPDATED_KEY); } catch { /* storage blocked */ }
      if (justUpdatedRecently(raw, Date.now())) {
        setUpToDate(true);
        window.setTimeout(() => setUpToDate(false), 3500);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const available = isUpdateAvailable(CURRENT, latest);
  const show = available && latest !== null && closedFor !== latest.build && !holdCardOnPath(pathname);

  const close = useCallback(() => {
    if (!latest) return;
    setClosedFor(latest.build);
    try { sessionStorage.setItem(DISMISS_KEY, latest.build); } catch { /* storage blocked */ }
  }, [latest]);

  // Esc closes it; the keyboard user lands on the main button
  useEffect(() => {
    if (!show) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, close]);

  async function applyUpdate() {
    if (updating) return;
    setUpdating(true);
    try { localStorage.setItem(JUST_UPDATED_KEY, String(Date.now())); } catch { /* storage blocked */ }
    try {
      // Make sure the phone has fetched the newest service worker before it reloads
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch { /* not fatal: the reload below still loads the new pages */ }
    window.location.reload();
  }

  return (
    <>
      {show && latest && (
        <div className="fixed inset-0 z-[250]" role="presentation">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={close} aria-hidden />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="update-card-title"
              aria-describedby="update-card-desc"
              className="animate-sheet-up pointer-events-auto relative w-full max-w-md overflow-hidden rounded-t-[24px] bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-slate-200 sm:rounded-[24px] sm:pb-5"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>

              <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-5 pb-5 pt-6 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20" aria-hidden>
                  <Rocket className="h-6 w-6" />
                </div>
                <h2 id="update-card-title" className="mt-3 text-xl font-black">A new version is ready</h2>
                <p id="update-card-desc" className="mt-1 text-sm text-violet-100">
                  Update Qubit Learn to get the latest improvements and fixes. It only takes a moment.
                </p>
              </div>

              <div className="px-5 pt-4">
                {latest.notes.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">What&apos;s new</p>
                    <ul className="mt-2 space-y-2">
                      {latest.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  ref={primary}
                  type="button"
                  onClick={() => void applyUpdate()}
                  disabled={updating}
                  className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-bold text-white hover:bg-violet-700 disabled:opacity-70"
                >
                  {updating ? (<><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Updating…</>) : "Update now"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  disabled={updating}
                  className="mt-2 h-12 w-full rounded-2xl text-base font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                >
                  Not now
                </button>
                <p className="mt-1 text-center text-[11px] text-slate-400">Your progress and saved questions are kept.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {upToDate && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-3 top-3 z-[260] mx-auto max-w-md"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          <p className="animate-fade-up flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden /> You&apos;re on the latest version
          </p>
        </div>
      )}
    </>
  );
}
