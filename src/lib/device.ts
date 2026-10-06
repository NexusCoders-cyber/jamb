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

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
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
