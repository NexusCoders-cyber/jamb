"use client";

/**
 * Facebook-style online presence.
 *
 * • <OnlineProvider> (mounted once inside AppShell) heartbeats the signed-in
 *   user's profiles.last_seen_at every 60s and polls "who is online"
 *   (heartbeat within the last 3 minutes) on the same cadence.
 * • <OnlineDot userId> renders the green dot next to an avatar — invisible
 *   when the user is offline, like Facebook.
 * • useOnlineUsers() exposes the Set for custom UIs ("Active now" labels).
 *
 * Requires supabase/online_status.sql (profiles.last_seen_at).
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;
const BEAT_INTERVAL_MS = 60 * 1000;

const OnlineContext = createContext<Set<string>>(new Set());

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [online, setOnline] = useState<Set<string>>(new Set());

  // Heartbeat: "I'm online"
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    const beat = async () => {
      // supabase-js builders are lazy — they only execute when awaited.
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
    };
    void beat();
    const t = setInterval(() => void beat(), BEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [user]);

  // Poll: who else is online
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .gt("last_seen_at", cutoff)
          .limit(2000);
        if (mounted) setOnline(new Set(((data ?? []) as Array<{ id: string }>).map((r) => r.id)));
      } catch {
        // column missing before online_status.sql runs — dots just stay hidden
      }
    };
    poll();
    const t = setInterval(poll, BEAT_INTERVAL_MS);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnlineUsers(): Set<string> {
  return useContext(OnlineContext);
}

/** Green presence dot — wrap the avatar in a `relative` container. */
export default function OnlineDot({ userId, size = 16 }: { userId: string; size?: number }) {
  const online = useOnlineUsers();
  if (!online.has(userId)) return null;
  const dot = Math.max(8, Math.round(size * 0.3));
  return (
    <span
      title="Online now"
      aria-label="Online now"
      className="absolute bottom-0 right-0 z-10 block rounded-full bg-emerald-500 ring-2 ring-white"
      style={{ width: dot, height: dot }}
    />
  );
}

/** "Active now" caption for chat headers — Facebook-style. */
export function OnlineStatusText({ userId }: { userId: string }) {
  const online = useOnlineUsers();
  return (
    <p className="text-xs text-slate-400">
      {online.has(userId)
        ? <span className="font-semibold text-emerald-600">Active now</span>
        : "View profile"}
    </p>
  );
}
