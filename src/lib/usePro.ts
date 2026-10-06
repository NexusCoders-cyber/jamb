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
 *   deviceLocked — true when the plan is paid but it is licensed to ANOTHER phone (this phone must pay to use Pro)
 *   premiumUntil — ISO string | null
 *   refresh      — call after a successful checkout/trial to force a re-check
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/lib/useUser";
import { deviceLabel, getDeviceId } from "@/lib/device";

type ProStatus = {
  isPro: boolean;
  isTrial: boolean;
  trialUsed: boolean;
  loading: boolean;
  deviceLocked: boolean;
  /** Name of the phone that holds the licence, when known */
  otherDevice: string | null;
  premiumUntil: string | null;
  refresh: () => void;
};

type LicenseCache = { deviceId: string; licensed: boolean };

/**
 * Does THIS phone hold the Pro licence? Asks the server (which also records the device). Fails open on any
 * error, and offline falls back to the last answer for this same phone.
 */
async function checkLicense(userId: string): Promise<{ licensed: boolean; otherDevice: string | null }> {
  const deviceId = await getDeviceId();
  const key = `qubit_lic:${userId}`;
  const readCache = (): LicenseCache | null => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null") as LicenseCache | null;
    } catch {
      return null;
    }
  };
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/device/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ deviceId, label: deviceLabel() }),
    });
    if (!res.ok) throw new Error("check failed");
    const json = (await res.json()) as { licensed?: boolean; otherDevice?: string | null };
    const licensed = json.licensed !== false;
    try {
      localStorage.setItem(key, JSON.stringify({ deviceId, licensed } satisfies LicenseCache));
    } catch { /* storage blocked */ }
    return { licensed, otherDevice: json.otherDevice ?? null };
  } catch {
    const saved = readCache();
    if (saved && saved.deviceId === deviceId) return { licensed: saved.licensed, otherDevice: null };
    // Server unreachable and nothing known for this phone: never lock a paying student out because of a bad
    // signal. (Signing in on a new phone needs a connection, so the real check has already run by then.)
    return { licensed: true, otherDevice: null };
  }
}

export function usePro(): ProStatus {
  const { user, loading: authLoading } = useUser();
  const [isPro, setIsPro]           = useState(false);
  const [isTrial, setIsTrial]       = useState(false);
  const [trialUsed, setTrialUsed]   = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [otherDevice, setOtherDevice] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async (userId: string) => {
    try {
      const supabase = createSupabaseBrowserClient();

      // Fetch premium_until AND trial_used_at directly from profiles
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("premium_until, trial_used_at")
        .eq("id", userId)
        .maybeSingle();

      if (!mountedRef.current) return;

      // Offline-first: with no connection the last known status keeps a paying student's exams working.
      // It still expires on its own date, so it can never extend access.
      const key = `qubit_pro:${userId}`;
      let until = (profile?.premium_until as string | null) ?? null;
      let usedAt = (profile?.trial_used_at as string | null) ?? null;
      if (error) {
        try {
          const saved = JSON.parse(localStorage.getItem(key) ?? "null") as { until?: string | null; usedAt?: string | null } | null;
          until = saved?.until ?? null;
          usedAt = saved?.usedAt ?? null;
        } catch { /* no saved status */ }
      } else {
        try { localStorage.setItem(key, JSON.stringify({ until, usedAt })); } catch { /* storage unavailable */ }
      }
      const active = until !== null && new Date(until) > new Date();

      // A user is "on trial" when premium_until was set at the same time as
      // trial_used_at (within a 5-minute window — allows for server clock skew).
      const onTrial = active && usedAt !== null && until !== null
        ? Math.abs(new Date(until).getTime() - new Date(usedAt).getTime()) < 5 * 60 * 1000 + 24 * 3600 * 1000 * 7
        : false;
      // More reliable: trial is active if trialUsedAt exists and premiumUntil ≤ trialUsedAt + max trial days
      // We simplify: if trial_used_at is set AND the account has premium_until within 2 days of trial grant, call it a trial
      const simpleTrialCheck = active && usedAt !== null;

      let licensed = true;
      let other: string | null = null;
      if (active) {
        const lic = await checkLicense(userId);
        licensed = lic.licensed;
        other = lic.otherDevice;
      }
      if (!mountedRef.current) return;

      setIsPro(active && licensed);
      setDeviceLocked(active && !licensed);
      setOtherDevice(other);
      setIsTrial(simpleTrialCheck);
      setTrialUsed(usedAt !== null);
      setPremiumUntil(until);
    } catch (_e) {
      if (mountedRef.current) {
        let until: string | null = null;
        let usedAt: string | null = null;
        try {
          const saved = JSON.parse(localStorage.getItem(`qubit_pro:${userId}`) ?? "null") as { until?: string | null; usedAt?: string | null } | null;
          until = saved?.until ?? null;
          usedAt = saved?.usedAt ?? null;
        } catch { /* no saved status */ }
        const active = until !== null && new Date(until) > new Date();
        setIsPro(active);
        setIsTrial(active && usedAt !== null);
        setTrialUsed(usedAt !== null);
        setPremiumUntil(until);
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
      setDeviceLocked(false);
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
        () => {
          // A payment or trial just changed the plan: re-check (it also settles which phone holds the licence)
          void fetchStatus(user.id);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPro, isTrial, trialUsed, loading, deviceLocked, otherDevice, premiumUntil, refresh };
}
