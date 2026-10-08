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
 *   needsVerify  — true when the plan is paid but this phone has been offline too long to confirm it (connect once)
 *   premiumUntil — ISO string | null
 *   refresh      — call after a successful checkout/trial to force a re-check
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUser } from "@/lib/useUser";
import { deviceLabel, getDeviceId } from "@/lib/device";
import { normalizeCache, offlineVerdict, trustedNow, type LicenseCache } from "@/lib/licensePolicy";

type ProStatus = {
  isPro: boolean;
  isTrial: boolean;
  trialUsed: boolean;
  loading: boolean;
  deviceLocked: boolean;
  /** Name of the phone that holds the licence, when known */
  otherDevice: string | null;
  /** Paid plan, but this phone has been offline too long (or never confirmed): connect once, no payment needed */
  needsVerify: boolean;
  premiumUntil: string | null;
  refresh: () => void;
};

type LicenseResult = { licensed: boolean; otherDevice: string | null; needsVerify: boolean };

/**
 * Does THIS phone hold the Pro licence? Asks the server (which also records the device — for every student, from
 * their first sign-in). With no connection it uses the last answer for this same phone, within the offline rules
 * in lib/licensePolicy.ts. If our own server is having trouble (the phone IS online) it fails open, so a paying
 * student is never locked out by our outage.
 */
async function checkLicense(userId: string): Promise<LicenseResult> {
  const deviceId = await getDeviceId();
  const key = `qubit_lic:${userId}`;
  const readCache = (): LicenseCache | null => {
    try {
      return normalizeCache(JSON.parse(localStorage.getItem(key) ?? "null"), trustedNow());
    } catch {
      return null;
    }
  };
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  try {
    if (offline) throw new Error("offline");
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
    const now = trustedNow();
    try {
      localStorage.setItem(key, JSON.stringify({ deviceId, licensed, checkedAt: now, seenAt: now } satisfies LicenseCache));
    } catch { /* storage blocked */ }
    return { licensed, otherDevice: json.otherDevice ?? null, needsVerify: false };
  } catch {
    const saved = readCache();
    if (saved && saved.deviceId === deviceId) {
      const v = offlineVerdict(saved, deviceId, trustedNow());
      return { ...v, otherDevice: null };
    }
    // Nothing known for this phone. Offline → it can't be confirmed, so ask to connect once (signing in needs a
    // connection, so on a real new phone the check has already run). Online → our server hiccuped: fail open.
    return offline ? { licensed: false, otherDevice: null, needsVerify: true } : { licensed: true, otherDevice: null, needsVerify: false };
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
  const [needsVerify, setNeedsVerify] = useState(false);
  const mountedRef = useRef(true);

  const fetchStatus = useCallback(async (userId: string) => {
    const key = `qubit_pro:${userId}`;
    const readSaved = () => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "null") as { until?: string | null; usedAt?: string | null } | null;
      } catch {
        return null; // no saved status
      }
    };

    let until: string | null = null;
    let usedAt: string | null = null;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("premium_until, trial_used_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      until = (profile?.premium_until as string | null) ?? null;
      usedAt = (profile?.trial_used_at as string | null) ?? null;
      try { localStorage.setItem(key, JSON.stringify({ until, usedAt })); } catch { /* storage unavailable */ }
    } catch {
      // Offline-first: with no connection the last known plan keeps a paying student's exams working. It still
      // expires on its own date, so it can never extend access.
      const saved = readSaved();
      until = saved?.until ?? null;
      usedAt = saved?.usedAt ?? null;
    }

    // "Now" never moves backwards, so setting the phone's clock back can't stretch an expired plan
    const active = until !== null && new Date(until).getTime() > trustedNow();

    // Every student's phone is recorded from their first sign-in; only a paid/trial plan needs the licence answer.
    let licensed = true;
    let other: string | null = null;
    let verify = false;
    if (active) {
      const lic = await checkLicense(userId).catch((): LicenseResult => ({ licensed: true, otherDevice: null, needsVerify: false }));
      licensed = lic.licensed;
      other = lic.otherDevice;
      verify = lic.needsVerify;
    } else {
      void checkLicense(userId).catch(() => undefined);
    }
    if (!mountedRef.current) return;

    setIsPro(active && licensed);
    setDeviceLocked(active && !licensed && !verify);
    setNeedsVerify(active && verify);
    setOtherDevice(other);
    setIsTrial(active && usedAt !== null);
    setTrialUsed(usedAt !== null);
    setPremiumUntil(until);
    setLoading(false);
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
      setNeedsVerify(false);
      setIsTrial(false);
      setTrialUsed(false);
      setPremiumUntil(null);
      setLoading(false);
      return;
    }
    void fetchStatus(user.id);
    return () => { mountedRef.current = false; };
  }, [user, authLoading, fetchStatus]);

  // Back online: settle the licence at once (a phone that was waiting to re-confirm its plan unlocks by itself)
  useEffect(() => {
    if (!user) return;
    const onOnline = () => void fetchStatus(user.id);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [user, fetchStatus]);

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

  return { isPro, isTrial, trialUsed, loading, deviceLocked, otherDevice, needsVerify, premiumUntil, refresh };
}
