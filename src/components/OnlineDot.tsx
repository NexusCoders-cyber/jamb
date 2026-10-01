"use client";

/**
 * Facebook-style online presence — INSTANT via Supabase Realtime.
 *
 * • <OnlineProvider> (mounted once in the root layout) joins a shared
 *   "online-users" presence channel. Joins/leaves propagate in realtime, so
 *   dots appear and disappear the moment someone opens/closes the app.
 * • A 60s heartbeat still writes profiles.last_seen_at (feeds "last seen"
 *   data and the fallback), and a slow 3-minute DB poll merges in anyone on
 *   a network that blocks websockets — dots still work there, just slower.
 * • <OnlineDot userId> renders the green dot next to an avatar — invisible
 *   when the user is offline, like Facebook.
 * • useOnlineUsers() exposes the Set for custom UIs ("Active now" labels).
 *
 * The realtime channel lives in a module-level singleton with reference
 * counting, so React StrictMode double-mounts and client-side navigations
 * never tear it down or duplicate it.
 *
 * Requires supabase/online_status.sql (profiles.last_seen_at).
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const ONLINE_WINDOW_MS = 3 * 60 * 1000; // DB fallback window
const BEAT_INTERVAL_MS = 60 * 1000; // last_seen_at heartbeat
const FALLBACK_POLL_MS = 3 * 60 * 1000; // slow — realtime normally covers this
const CHANNEL_TOPIC = "online-users";

// ─── Shared presence channel (one per page load) ─────────────────────────────

type SharedPresence = {
  channel: RealtimeChannel;
  /** User ids currently tracked on the channel (mutated in place on sync). */
  realtime: Set<string>;
  listeners: Set<() => void>;
  status: "connecting" | "subscribed" | "failed";
  /** Deferred track() until the channel finishes subscribing. */
  pendingTrack: (() => void) | null;
  trackedUserId: string | null;
};

let shared: SharedPresence | null = null;

function ensurePresence(): SharedPresence {
  if (shared) return shared;

  const supabase = createSupabaseBrowserClient();
  const s: SharedPresence = {
    channel: supabase.channel(CHANNEL_TOPIC),
    realtime: new Set<string>(),
    listeners: new Set(),
    status: "connecting",
    pendingTrack: null,
    trackedUserId: null,
  };
  shared = s;

  const sync = () => {
    // presenceState: { presenceKey: [{ user_id, presence_ref }, …] }.
    // We track with the user's id as key, so multi-tab sign-ins of the same
    // user merge under one key and only go offline when the last tab closes.
    s.realtime.clear();
    for (const metas of Object.values(s.channel.presenceState<{ user_id: string }>())) {
      for (const meta of metas) {
        if (meta?.user_id) s.realtime.add(meta.user_id);
      }
    }
    s.listeners.forEach((l) => l());
  };

  s.channel
    .on("presence", { event: "sync" }, sync)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        s.status = "subscribed";
        s.pendingTrack?.();
        s.pendingTrack = null;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // Degrade to the DB-poll fallback; realtime may reconnect on its own.
        if (status !== "CLOSED") s.status = "failed";
      }
    });

  return s;
}

// ─── Context + provider ──────────────────────────────────────────────────────

const OnlineContext = createContext<ReadonlySet<string>>(new Set());

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [version, setVersion] = useState(0);
  const [dbOnline, setDbOnline] = useState<Set<string>>(new Set());

  // Subscribe this provider instance to the shared channel's change events.
  useEffect(() => {
    const s = ensurePresence();
    const bump = () => setVersion((v) => v + 1);
    s.listeners.add(bump);
    bump(); // catch up if the channel already synced before we mounted
    return () => {
      s.listeners.delete(bump);
    };
  }, []);

  // Track me as online (and untrack on sign-out).
  useEffect(() => {
    const s = ensurePresence();
    if (!user) {
      if (s.trackedUserId) {
        s.trackedUserId = null;
        void s.channel.untrack();
      }
      return;
    }
    const track = () => {
      s.trackedUserId = user.id;
      void s.channel.track({ user_id: user.id });
    };
    if (s.status === "subscribed") track();
    else s.pendingTrack = track;
  }, [user]);

  // Heartbeat: keep profiles.last_seen_at fresh (last-seen data + fallback).
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

  // Fallback: slow DB poll merges in users whose network blocks websockets.
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
        if (mounted) {
          setDbOnline(new Set(((data ?? []) as Array<{ id: string }>).map((r) => r.id)));
          setVersion((v) => v + 1);
        }
      } catch {
        // column missing before online_status.sql runs — dots just stay hidden
      }
    };
    void poll();
    const t = setInterval(() => void poll(), FALLBACK_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // realtime ∪ db-fallback, rebuilt whenever either source changes.
  const online = useMemo(() => {
    const merged = new Set(dbOnline);
    for (const id of shared?.realtime ?? []) merged.add(id);
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, dbOnline]);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnlineUsers(): ReadonlySet<string> {
  return useContext(OnlineContext);
}

// ─── UI ──────────────────────────────────────────────────────────────────────

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
