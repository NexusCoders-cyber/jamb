"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

/**
 * Returns the currently authenticated Supabase user (or null when signed out).
 *
 * Robustness rules (these prevent the "Sign in required" wall + redirect loop):
 * - A successful session or a successful server verification always wins.
 * - A null session is NEVER trusted on its own: we ask the Supabase server
 *   (getUser) before clearing the user. The server call auto-refreshes the
 *   token from the valid cookie, so a flaky local refresh can't sign you out
 *   while your session cookie is still good.
 * - Only an explicit SIGNED_OUT event — or a failed server verification —
 *   clears the user.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (_e) {
      // Env vars not available (e.g. during static pre-render or missing .env.local)
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        // Network failure — stop spinning; the listener will resolve real state.
        if (!cancelled) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        return;
      }

      if (session) {
        setUser(session.user);
        return;
      }

      // Null session on a non-signout event — verify with the server before
      // trusting it. getUser() reads the auth cookie and refreshes if needed,
      // so it can recover a session the local observer temporarily lost.
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (!cancelled) setUser(data.user ?? null);
        })
        .catch(() => {
          // Server also rejects it — genuinely signed out / dead refresh token.
          if (!cancelled) setUser(null);
        });
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
