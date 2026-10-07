"use client";

/**
 * Asks the browser to keep this app's saved data (questions, unfinished exams, bookmarks) instead of clearing it
 * when the phone runs low on space. Without this, Safari on iPhone can erase a website's storage after about a
 * week of not opening it, and Android Chrome may evict it under pressure. Installed apps are granted it far more
 * readily, which is one more reason to install.
 */
export type StorageStatus = { persisted: boolean; usedMB: number | null; quotaMB: number | null };

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  let persisted = false;
  let usedMB: number | null = null;
  let quotaMB: number | null = null;
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? false;
    const est = await navigator.storage?.estimate?.();
    if (est) {
      usedMB = est.usage != null ? Math.round(est.usage / 1048576) : null;
      quotaMB = est.quota != null ? Math.round(est.quota / 1048576) : null;
    }
  } catch {
    /* unsupported browser: report unknowns */
  }
  return { persisted, usedMB, quotaMB };
}

/** iPhone/iPad Safari in a normal tab (not installed): Apple may clear saved data after ~7 days unused. */
export function isIosBrowserTab(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return ios && !standalone;
}
