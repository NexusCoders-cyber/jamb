"use client";

/**
 * usePro — returns the current user's Pro status.
 *
 * Reads from Supabase's my_premium_status() RPC on mount, then subscribes
 * to profile row changes (realtime) so the UI updates the instant a payment
 * is verified — no page reload needed.
 *
 * Returns:
 *   isPro      — true when premium_until > now()
 *   loading    — true on first render while status is unknown
 *   premiumUntil — ISO string | null
 *   refresh    — call after a successful checkout to force a re-check
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/lib/useUser";

type ProStatus = {
  isPro: boolean;
  loading: boolean;
  premiumUntil: string | null;
  refresh: () => void;
};

export function usePro(): ProStatus {
  const { user, loading: authLoading } = useUser();
  const [isPro, setIsPro] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.rpc("my_premium_status", { p_user: userId });
      if (!mountedRef.current) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setIsPro(Boolean(row.is_pro));
        setPremiumUntil((row.premium_until as string | null) ?? null);
      } else {
        setIsPro(false);
        setPremiumUntil(null);
      }
    } catch (_e) {
      // RPC not deployed yet — default to free
      setIsPro(false);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (user) {
      setLoading(true);
      void fetchStatus(user.id);
    }
  }, [user, fetchStatus]);

  useEffect(() => {
    mountedRef.current = true;
    if (authLoading) return;
    if (!user) {
      setIsPro(false);
      setPremiumUntil(null);
      setLoading(false);
      return;
    }
    void fetchStatus(user.id);
    return () => { mountedRef.current = false; };
  }, [user, authLoading, fetchStatus]);

  // Realtime subscription — profile row updates fire when verify route
  // sets premium_until, so the UI reacts instantly without a refresh.
  useEffect(() => {
    if (!user) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch (_e) { return; }

    const channel = supabase
      .channel(`pro-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { premium_until?: string | null };
          const until = row.premium_until ?? null;
          const active = until !== null && new Date(until) > new Date();
          setIsPro(active);
          setPremiumUntil(until);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPro, loading, premiumUntil, refresh };
}
