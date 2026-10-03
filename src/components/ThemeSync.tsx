"use client";

import { useEffect } from "react";
import { applyTheme, readThemePref } from "@/lib/theme";

/**
 * Mounted once in the root layout. The inline script already set the right theme before first paint;
 * this makes sure the status-bar colour matches and keeps the page correct if that script was blocked.
 */
export default function ThemeSync() {
  useEffect(() => {
    applyTheme(readThemePref());
  }, []);
  return null;
}
