"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_DAILY_GOAL, parseDailyGoal } from "@/lib/trends";

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener("focus", cb); // coming back from Settings in the same tab
  document.addEventListener("visibilitychange", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("focus", cb);
    document.removeEventListener("visibilitychange", cb);
  };
}

function read(): number {
  try {
    return parseDailyGoal(window.localStorage.getItem("orbit_prefs"));
  } catch {
    return DEFAULT_DAILY_GOAL;
  }
}

/** The student's daily question goal (Settings → Study). Same number on the dashboard and in analytics. */
export function useDailyGoal(): number {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_DAILY_GOAL);
}
