"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getMeta, getPendingSummary, storageMode, subscribeLocal, type PendingSummary } from "@/lib/localDb";
import { LAST_SYNC_META, syncToCloud, type SyncResult } from "@/lib/sync";

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

const EMPTY: PendingSummary = { attempts: 0, bookmarks: 0, deletions: 0, total: 0 };

/**
 * State for the "Back up" UI: what is waiting on this device, when the last backup happened, whether the
 * phone is online, and a `sync()` that the student triggers explicitly.
 */
export function useSyncStatus(userId: string | null | undefined) {
  const [pending, setPending] = useState<PendingSummary>(EMPTY);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [persistent, setPersistent] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [p, last] = await Promise.all([getPendingSummary(userId), getMeta<string>(LAST_SYNC_META(userId))]);
    if (!mounted.current) return;
    setPending(p);
    setLastSyncAt(last ?? null);
    setPersistent(storageMode() === "indexeddb");
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const unsub = subscribeLocal(() => void refresh());
    return () => {
      mounted.current = false;
      unsub();
    };
  }, [refresh]);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!userId) return null;
    setSyncing(true);
    try {
      const res = await syncToCloud(createSupabaseBrowserClient(), userId);
      if (mounted.current) setResult(res);
      await refresh();
      return res;
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [userId, refresh]);

  return { pending, lastSyncAt, online, syncing, result, persistent, sync, refresh };
}
