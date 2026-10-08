"use client";

/**
 * A random id that stays on this phone (kept in two places so clearing one doesn't lose it) plus a friendly name
 * like "SM-A546B · Chrome". It identifies the phone for the "one Pro licence per phone" rule — it is not a
 * hardware fingerprint and contains nothing personal.
 */
import { getMeta, setMeta } from "./localDb";

const KEY = "qubit_device_id";
let cached: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Inside a native Android/iOS shell (a Capacitor build of this app) the phone's own id is available and survives
 * reinstalling the app, so it is used instead of the random one. A website or Play-Store "web app" cannot read the
 * Android ID — browsers don't allow it — so there the random id below is the closest equivalent.
 */
async function nativeDeviceId(): Promise<string | null> {
  try {
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Device?: { getId?: () => Promise<{ identifier?: string }> } } };
    }).Capacitor;
    if (!cap?.isNativePlatform?.() || !cap.Plugins?.Device?.getId) return null;
    const { identifier } = await cap.Plugins.Device.getId();
    const clean = (identifier ?? "").replace(/[^A-Za-z0-9]/g, "");
    return clean.length >= 12 ? `and-${clean}`.slice(0, 64) : null;
  } catch {
    return null;
  }
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const native = await nativeDeviceId();
  if (native) {
    cached = native;
    return native;
  }
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch { /* storage blocked */ }
  if (!id) {
    try {
      id = (await getMeta<string>(KEY)) ?? null;
    } catch { /* ignore */ }
  }
  if (!id || id.length < 16) id = randomId();
  try {
    localStorage.setItem(KEY, id);
  } catch { /* storage blocked */ }
  try {
    await setMeta(KEY, id);
  } catch { /* ignore */ }
  cached = id;
  return id;
}

export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const browser = /EdgA?\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const android = /Android [\d.]+; ([^;)]+)/.exec(ua);
  if (android) return `${android[1].trim()} · ${browser}`;
  if (/iPhone/.test(ua)) return `iPhone · ${browser}`;
  if (/iPad/.test(ua)) return `iPad · ${browser}`;
  if (/Windows/.test(ua)) return `Windows PC · ${browser}`;
  if (/Mac OS X/.test(ua)) return `Mac · ${browser}`;
  if (/Linux/.test(ua)) return `Linux · ${browser}`;
  return browser;
}

/** Header that tells the server which phone is asking (so a shared paid login can't be used from another phone). */
export async function deviceHeaders(): Promise<Record<string, string>> {
  try {
    return { "x-device-id": await getDeviceId() };
  } catch {
    return {};
  }
}
