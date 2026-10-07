"use client";

/**
 * AuthGuard — wraps any protected page content.
 *
 * - While auth is loading: shows a full-screen spinner (prevents flash of "Sign in" wall).
 * - Once resolved with no user: renders the fallback (defaults to a redirect-to-login card).
 * - Once resolved with a user: renders children.
 *
 * Usage:
 *   <AuthGuard user={user} loading={authLoading}>
 *     … authenticated content …
 *   </AuthGuard>
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

interface Props {
  user: unknown;
  loading: boolean;
  children: React.ReactNode;
  /** Custom fallback shown when not authenticated. Defaults to a sign-in prompt card. */
  fallback?: React.ReactNode;
}

export default function AuthGuard({ user, loading, children, fallback }: Props) {
  const pathname = usePathname();

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

  if (!user) {
    return (
      fallback ?? (
        <div className="flex min-h-dvh items-center justify-center bg-[#eef2ff] px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200 shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
              <Lock className="h-8 w-8 text-violet-600" aria-hidden />
            </div>
            <h2 className="text-xl font-black text-slate-900">Sign in required</h2>
            <p className="mt-2 text-sm text-slate-500">You need to be signed in to view this page.</p>
            <Link href={`/?next=${encodeURIComponent(pathname)}`} className="mt-6 flex h-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700">
              Sign in
            </Link>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
