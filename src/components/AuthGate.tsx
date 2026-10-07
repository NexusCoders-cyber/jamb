"use client";

/**
 * AuthGate — wraps auth-only pages (/, /signup).
 *
 * - Spinner while the session resolves (no flash of the login form).
 * - Already signed in → redirect to ?next= (or /dashboard). There is no
 *   middleware in this app, so this is what keeps signed-in users off the
 *   login screen.
 * - Signed out → render children (the login/signup form).
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "@/lib/useUser";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#eef2ff]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          <p className="text-sm font-semibold text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
