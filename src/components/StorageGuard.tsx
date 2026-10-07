"use client";

import { useEffect } from "react";
import { requestPersistentStorage } from "@/lib/storagePersist";
import { syncQuestionsInBackground } from "@/lib/questionSync";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Invisible. Once per visit (and again whenever the phone regains a connection):
 *  1. asks the browser to keep the saved questions/exams safe from automatic clean-up, and
 *  2. tops up the saved question pool for the student's subjects (which also saves them in the database).
 */
export default function StorageGuard() {
  useEffect(() => {
    let cancelled = false;
    void requestPersistentStorage();

    async function topUp() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return; // the questions API needs a signed-in student
        const { data: profile } = await supabase.from("profiles").select("interests").eq("id", session.user.id).maybeSingle();
        if (cancelled) return;
        await syncQuestionsInBackground((profile?.interests as string[] | null) ?? []);
      } catch {
        /* background only */
      }
    }

    const first = window.setTimeout(() => void topUp(), 6000); // after the first screen is usable
    const onOnline = () => window.setTimeout(() => void topUp(), 3000);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
}
