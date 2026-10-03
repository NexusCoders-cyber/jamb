"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * Quick light/dark switch for the app bars.
 *   icon   – round button (mobile top bar)
 *   switch – labelled row with a sliding switch (desktop sidebar)
 * The full Light / Dark / System choice lives in Settings → Appearance.
 */
export default function ThemeToggle({ variant = "icon", className = "" }: { variant?: "icon" | "switch"; className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";

  if (variant === "switch") {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={toggle}
        className={`flex w-full touch-manipulation items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 ${className}`}
      >
        {dark ? <Moon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden /> : <Sun className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} aria-hidden />}
        <span className="flex-1 text-left">Dark mode</span>
        <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${dark ? "bg-violet-600" : "bg-slate-200"}`} aria-hidden>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${dark ? "left-[1.125rem]" : "left-0.5"}`} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`flex h-8 w-8 touch-manipulation items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
