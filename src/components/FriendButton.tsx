"use client";

import { useEffect, useState } from "react";
import { Check, Clock, UserPlus, UserRoundCheck } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getMyFriendships, sendFriendRequest, acceptFriendRequest, removeFriendship,
  type Friendship,
} from "@/lib/queries";

type Status = "loading" | "self" | "none" | "outgoing" | "incoming" | "friends";

/**
 * Friendship button for one target user:
 *   none     → "Add friend" (sends request + notification)
 *   outgoing → "Requested" (tap to cancel)
 *   incoming → "Accept"    (tap to accept + notify requester)
 *   friends  → "Friends"   (tap asks to unfriend)
 * Re-fetched whenever `reloadKey` changes (parents bump it after actions).
 */
export default function FriendButton({
  targetUserId,
  reloadKey = 0,
  compact = false,
}: {
  targetUserId: string;
  reloadKey?: number;
  compact?: boolean;
}) {
  const { user } = useUser();
  const [status, setStatus] = useState<Status>("loading");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.id === targetUserId) { setStatus("self"); return; }
    let mounted = true;
    const supabase = createSupabaseBrowserClient();
    getMyFriendships(supabase, user.id).then((rows: Friendship[]) => {
      if (!mounted) return;
      const rel = rows.find(
        (r) =>
          (r.requester_id === user.id && r.addressee_id === targetUserId) ||
          (r.addressee_id === user.id && r.requester_id === targetUserId),
      );
      if (!rel) setStatus("none");
      else if (rel.status === "accepted") { setStatus("friends"); setRequestId(rel.id); }
      else if (rel.requester_id === user.id) { setStatus("outgoing"); setRequestId(rel.id); }
      else { setStatus("incoming"); setRequestId(rel.id); }
    });
    return () => { mounted = false; };
  }, [user, targetUserId, reloadKey]);

  if (!user || status === "loading" || status === "self") return null;

  const myName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "A student";

  async function act() {
    if (!user || busy) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (status === "none") {
        const ok = await sendFriendRequest(supabase, user.id, targetUserId, myName);
        if (ok) setStatus("outgoing");
      } else if ((status === "outgoing" || status === "friends") && requestId) {
        const ok = await removeFriendship(supabase, requestId);
        if (ok) { setStatus("none"); setRequestId(null); }
      } else if (status === "incoming" && requestId) {
        const ok = await acceptFriendRequest(supabase, requestId, targetUserId, myName);
        if (ok) setStatus("friends");
      }
    } finally {
      setBusy(false);
    }
  }

  const base = compact
    ? "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-50";

  if (status === "friends") {
    return (
      <button type="button" onClick={act} disabled={busy} title="Tap to unfriend"
        className={`${base} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}>
        <UserRoundCheck className="h-4 w-4" aria-hidden /> Friends
      </button>
    );
  }
  if (status === "outgoing") {
    return (
      <button type="button" onClick={act} disabled={busy} title="Tap to cancel request"
        className={`${base} bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700`}>
        <Clock className="h-4 w-4" aria-hidden /> Requested
      </button>
    );
  }
  if (status === "incoming") {
    return (
      <button type="button" onClick={act} disabled={busy}
        className={`${base} bg-violet-600 text-white shadow-sm shadow-violet-300/40 hover:bg-violet-700`}>
        {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="h-4 w-4" aria-hidden />}
        Accept request
      </button>
    );
  }
  return (
    <button type="button" onClick={act} disabled={busy}
      className={`${base} bg-violet-100 text-violet-700 hover:bg-violet-200`}>
      {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /> : <UserPlus className="h-4 w-4" aria-hidden />}
      Add friend
    </button>
  );
}
