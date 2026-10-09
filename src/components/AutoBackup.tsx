"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPendingSummary, subscribeLocal } from "@/lib/localDb";
import { syncToCloud } from "@/lib/sync";
import { createAutoBackup } from "@/lib/autoBackup";

/**
 * Invisible. Copies finished exams to the signed-in student's account without being asked: right after submit,
 * when signal comes back, and when the app is opened again. Results are always safe on the device first.
 */
export default function AutoBackup() {
  const { user } = useUser();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const supabase = createSupabaseBrowserClient();
    const auto = createAutoBackup({
      pendingCount: async () => {
        const p = await getPendingSummary(userId);
        return p.attempts + p.deletions;
      },
      backup: async () => (await syncToCloud(supabase, userId)).ok,
      isOnline: () => navigator.onLine !== false,
    });

    const onOnline = () => auto.kick({ resetBackoff: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") auto.kick();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const unsub = subscribeLocal(() => auto.kick()); // an exam was saved on this device
    auto.kick(); // app opened: send anything left from earlier

    return () => {
      auto.stop();
      unsub();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  return null;
}
