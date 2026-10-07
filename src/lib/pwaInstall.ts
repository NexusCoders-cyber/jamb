"use client";

/**
 * One place that owns the browser's "install this app" prompt, so the floating banner AND the Download buttons on
 * the landing page can both use it. Chrome fires `beforeinstallprompt` once; whoever calls initInstallCapture()
 * first (the root layout does) keeps the event for everyone.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = { canPrompt: boolean; installed: boolean };

let deferred: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
let started = false;
let snapshot: InstallState = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true || document.referrer.startsWith("android-app://");
}

function publish() {
  const next: InstallState = { canPrompt: deferred !== null, installed: installedFlag || isStandalone() };
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
}

export function initInstallCapture(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    installedFlag = true;
    deferred = null;
    publish();
  });
  publish();
}

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getInstallState = (): InstallState => snapshot;
export const getServerInstallState = (): InstallState => ({ canPrompt: false, installed: false });

/** Shows the browser's install dialog. "unavailable" = this browser has not offered one (use the manual steps). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  const ev = deferred;
  deferred = null; // a prompt can only be used once
  publish();
  try {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    if (outcome === "accepted") {
      installedFlag = true;
      publish();
    }
    return outcome;
  } catch {
    return "unavailable";
  }
}

export type Platform = "ios" | "android" | "desktop";
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
