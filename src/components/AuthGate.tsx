"use client";

/**
 * AuthGate — wraps client pages that should redirect when auth state is known.
 *
 * Usage on auth-only pages (/, /signup):
 *   Renders a full-screen spinner while the session is loading.
 *   Once resolved, renders children (middleware handles the actual redirect).
 *
 * This prevents the flash of the login form for already-authenticated users
 * while the middleware redirect is in flight.
 */

import { useUser } from "@/lib/useUser";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useUser();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef2ff]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          <p className="text-sm font-semibold text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
