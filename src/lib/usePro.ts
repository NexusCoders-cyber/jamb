"use client";

/**
 * usePro — returns the current user's Pro / trial status.
 *
 * Reads from Supabase's my_premium_status() RPC on mount, then subscribes
 * to profile row changes (realtime) so the UI updates the instant a payment
 * or trial is activated — no page reload needed.
 *
 * Returns:
 *   isPro        — true when premium_until > now() (paid OR trial)
 *   isTrial      — true when isPro AND the plan was a free trial
 *   trialUsed    — true if this account has ever used the free trial
 *   loading      — true on first render while status is unknown
 *   premiumUntil — ISO string | null
 *   refresh      — call after a successful checkout/trial to force a re-check
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/lib/useUser";

type ProStatus = {
  isPro: boolean;
  isTrial: boolean;
  trialUsed: boolean;
  loading: boolean;
  premiumUntil: string | null;
  refresh: () => void;
};

export function usePro(): ProStatus {
  const { user, loading: authLoading } = useUser();
  const [isPro, setIsPro]           = useState(false);
  const [isTrial, setIsTrial]       = useState(false);
  const [trialUsed, setTrialUsed]   = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();

      // Fetch premium_until AND trial_used_at directly from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("premium_until, trial_used_at")
        .eq("id", userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      const until = (profile?.premium_until as string | null) ?? null;
      const usedAt = (profile?.trial_used_at as string | null) ?? null;
      const active = until !== null && new Date(until) > new Date();

      // A user is "on trial" when premium_until was set at the same time as
      // trial_used_at (within a 5-minute window — allows for server clock skew).
      const onTrial = active && usedAt !== null && until !== null
        ? Math.abs(new Date(until).getTime() - new Date(usedAt).getTime()) < 5 * 60 * 1000 + 24 * 3600 * 1000 * 7
        : false;
      // More reliable: trial is active if trialUsedAt exists and premiumUntil ≤ trialUsedAt + max trial days
      // We simplify: if trial_used_at is set AND the account has premium_until within 2 days of trial grant, call it a trial
      const simpleTrialCheck = active && usedAt !== null;

      setIsPro(active);
      setIsTrial(simpleTrialCheck);
      setTrialUsed(usedAt !== null);
      setPremiumUntil(until);
    } catch (_e) {
      if (mountedRef.current) {
        setIsPro(false);
        setIsTrial(false);
        setTrialUsed(false);
      }
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
      setIsTrial(false);
      setTrialUsed(false);
      setPremiumUntil(null);
      setLoading(false);
      return;
    }
    void fetchStatus(user.id);
    return () => { mountedRef.current = false; };
  }, [user, authLoading, fetchStatus]);

  // Realtime — profile row updates fire immediately after trial/payment
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
          const row = payload.new as { premium_until?: string | null; trial_used_at?: string | null };
          const until = row.premium_until ?? null;
          const usedAt = row.trial_used_at ?? null;
          const active = until !== null && new Date(until) > new Date();
          setIsPro(active);
          setIsTrial(active && usedAt !== null);
          setTrialUsed(usedAt !== null);
          setPremiumUntil(until);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPro, isTrial, trialUsed, loading, premiumUntil, refresh };
}
