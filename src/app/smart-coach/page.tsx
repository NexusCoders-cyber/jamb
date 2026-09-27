"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Smart Coach has been merged into Practice / Study mode.
 * Redirect anyone who lands here (bookmarks, old links) to /practice.
 */
export default function SmartCoachRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/practice"); }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef2ff]">
      <p className="text-sm font-semibold text-slate-400">Redirecting to Practice…</p>
    </main>
  );
}
