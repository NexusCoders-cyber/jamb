"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_COLOR, THEME_KEY, type ThemePref } from "@/lib/theme-init";

export type { ThemePref };
export type ResolvedTheme = "light" | "dark";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const isPref = (v: unknown): v is ThemePref => v === "light" || v === "dark" || v === "system";

/** The saved choice. Older versions stored it inside `orbit_prefs`; an explicit light/dark there is honoured once. */
export function readThemePref(): ThemePref {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (isPref(saved)) return saved;
    const legacy = (JSON.parse(window.localStorage.getItem("orbit_prefs") ?? "{}") as { theme?: string }).theme;
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    /* private mode / blocked storage → default */
  }
  return DEFAULT_THEME;
}

export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "dark" || (pref === "system" && systemPrefersDark()) ? "dark" : "light";
}

/** Put the theme on the page: the `dark` class, native control colours and the phone's status-bar colour. */
export function applyTheme(pref: ThemePref, animate = false): void {
  if (typeof document === "undefined") return;
  const dark = resolveTheme(pref) === "dark";
  const root = document.documentElement;
  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-transition");
    window.setTimeout(() => root.classList.remove("theme-transition"), 260);
  }
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light));
}

export function setThemePref(pref: ThemePref): void {
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage blocked: the choice still applies for this visit */
  }
  applyTheme(pref, true);
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // another tab changed the theme → follow it
    if (e.key === THEME_KEY || e.key === null) {
      applyTheme(readThemePref());
      cb();
    }
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readThemePref() === "system") applyTheme("system");
    cb();
  };
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystem);
  };
}

/**
 * pref     – what the student chose (light / dark / system)
 * resolved – what is actually showing right now (system → light or dark)
 */
export function useTheme(): { pref: ThemePref; resolved: ResolvedTheme; setPref: (p: ThemePref) => void; toggle: () => void } {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => DEFAULT_THEME);
  const resolved = useSyncExternalStore<ResolvedTheme>(subscribe, () => resolveTheme(readThemePref()), () => resolveTheme(DEFAULT_THEME));
  const toggle = useCallback(() => setThemePref(resolveTheme(readThemePref()) === "dark" ? "light" : "dark"), []);
  return { pref, resolved, setPref: setThemePref, toggle };
}
