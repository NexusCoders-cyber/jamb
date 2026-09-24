"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#eef2ff] px-4 text-center">
      <div className="rounded-[32px] bg-white p-10 shadow-[0_18px_60px_rgba(93,74,228,0.1)] ring-1 ring-slate-200 max-w-md w-full">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-4xl">
          ⚠️
        </div>
        <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-500">
          An unexpected error occurred. You can try again or go back to the dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-400">Error ID: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={reset}
            className="flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
