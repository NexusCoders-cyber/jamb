"use client";

/**
 * useAdminRole — reads `role` from the signed-in user's profile.
 *
 * Also keeps the role in localStorage per user so the admin shell can render
 * instantly on repeat visits (still re-verified against Supabase every load,
 * and RLS is the real gate — the client hint only controls UI).
 */

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/lib/useUser";

const CACHE_PREFIX = "orbit_role:";

export function useAdminRole() {
  const { user, loading: authLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); setLoading(false); return; }

    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    // Optimistic hint from cache (per-user, so it never leaks across accounts)
    try {
      if (localStorage.getItem(CACHE_PREFIX + user.id) === "admin") {
        setIsAdmin(true);
      }
    } catch { /* ignore */ }

    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!mounted) return;
        const admin = data?.role === "admin";
        setIsAdmin(admin);
        setLoading(false);
        try {
          localStorage.setItem(CACHE_PREFIX + user.id, admin ? "admin" : "student");
        } catch { /* ignore */ }
      });

    return () => { mounted = false; };
  }, [user, authLoading]);

  return { user, isAdmin, loading: authLoading || loading };
}
