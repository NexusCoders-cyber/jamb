"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot, { useOnlineUsers } from "@/components/OnlineDot";
import ExplanationView from "@/components/ExplanationView";
import FriendButton from "@/components/FriendButton";
import { getMyFriendships, getProfile, type Friendship } from "@/lib/queries";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Award, Check, Copy, Crown, Link2, MessageCircle, Send, Swords, Timer, Trophy, Users, X, Zap,
} from "lucide-react";

const TURN_SECONDS = 10;
/** Must stay ≥ the server's CLAIM_GRACE_MS (25s) + a small clock-skew buffer. */
const CLAIM_GRACE_SECONDS = 27;

type MatchState = {
  matchId: string;
  subject: string;
  status: "waiting" | "active" | "completed" | "declined" | "expired";
  yourSide: "host" | "guest";
  yourIndex: number;
  yourScore: number;
  yourFinished: boolean;
  oppScore: number;
  oppIndex: number;
  oppFinished: boolean;
  isDuel: boolean;
  currentTurn: "host" | "guest" | null;
  turnEndsAt: string | null;
  winnerId: string | null;
  oppId: string | null;
  oppName: string | null;
  oppSeenAt: string | null;
  question: { id: string; prompt: string; options: string[]; subject?: string | null } | null;
  total: number;
  answerKey: Array<{ id: string; answer: number; explanation: string | null }> | null;
};

type ArenaSubject = { name: string };

const ARENA_SUBJECTS: ArenaSubject[] = [
  { name: "English Language" },
  { name: "Mathematics" },
  { name: "Physics" },
  { name: "Chemistry" },
  { name: "Biology" },
  { name: "Economics" },
  { name: "Government" },
  { name: "Literature" },
  { name: "The Lekki Headmaster (Novel)" },
];

type PersonRow = { id: string; full_name: string; avatar_url: string | null; user_code: string | null };
type InviteRow = { id: string; match_id: string; subject: string | null; fromName: string };
type ChatMsg = { id: string; user_id: string; name: string; text: string; at: string };

export default function ArenaPage() {
  const { user, loading: authLoading } = useUser();

  // Setup
  const [subjects] = useState(ARENA_SUBJECTS);
  const [subject, setSubject] = useState("");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [myName, setMyName] = useState("");

  // Live match
  const [match, setMatch] = useState<MatchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | "timeout" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invites + online players
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const onlineUsers = useOnlineUsers();

  // Duel presence + chat
  const [oppOnline, setOppOnline] = useState<boolean | null>(null);
  const [claimIn, setClaimIn] = useState<number | null>(null);
  const claimFiredRef = useRef(false);
  const claimCooldownUntilRef = useRef(0);
  const oppSeenRef = useRef<string | null>(null);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const chatOpenRef = useRef(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }, []);

  const loadInvites = useCallback(async () => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("quiz_invites")
      .select("id, match_id, subject, from:profiles!quiz_invites_from_id_fkey(full_name)")
      .eq("to_id", user.id)
      .eq("status", "pending");
    const rows = ((data ?? []) as unknown) as Array<{ id: string; match_id: string; subject: string | null; from: { full_name: string } }>;
    setInvites(rows.map((r) => ({ id: r.id, match_id: r.match_id, subject: r.subject, fromName: r.from?.full_name ?? "A student" })));
  }, [user]);

  // Friends + invites + my points + my name
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    getMyFriendships(supabase, user.id).then((rows) => {
      setFriends(rows.filter((r) => r.status === "accepted"));
      setFriendsLoaded(true);
    });
    getProfile(supabase, user.id).then((p) => setMyName(p?.full_name ?? "Player"));
    void loadInvites();
    supabase.rpc("my_total_points", { p_user: user.id }).then(({ data }) => setMyPoints(Number(data ?? 0)));
  }, [user, loadInvites]);

  // ── Rejoin an unfinished duel/solo after a reload or navigation ──────────
  // Without this, a mid-game refresh strands the player in the lobby while the
  // duel carries on without them — the "we're not seeing the same game" bug.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from("quiz_matches")
        .select("id")
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .in("status", ["waiting", "active"])
        .gte("created_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      const id = (data?.[0] as { id: string } | undefined)?.id;
      if (!id || cancelled) return;
      const res = await fetch(`/api/quiz/match/${id}`, { headers: await authHeaders(), cache: "no-store" });
      if (!cancelled && res.ok) setMatch((await res.json()) as MatchState);
    })();
    return () => { cancelled = true; };
  }, [user, authHeaders]);

  // Live invite arrivals (needs quiz_invites in the realtime publication —
  // see supabase/duel_upgrades.sql). A slow interval covers older databases.
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`arena-invites-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quiz_invites", filter: `to_id=eq.${user.id}` }, () => void loadInvites())
      .subscribe();
    const t = setInterval(() => void loadInvites(), 45_000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [user, loadInvites]);

  // Who is online right now (anyone — friends or not)
  useEffect(() => {
    if (!user) return;
    const ids = [...onlineUsers].filter((id) => id !== user.id);
    if (ids.length === 0) { setPeople([]); return; }
    const supabase = createSupabaseBrowserClient();
    let mounted = true;
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, user_code")
      .in("id", ids)
      .limit(100)
      .then(({ data }) => {
        if (!mounted) return;
        setPeople(((data ?? []) as PersonRow[]).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      });
    return () => { mounted = false; };
  }, [onlineUsers, user]);

  const friendIds = useMemo(() => {
    const s = new Set<string>();
    for (const f of friends) s.add(f.requester_id === user?.id ? f.addressee_id : f.requester_id);
    return s;
  }, [friends, user?.id]);

  // Native share availability (state — avoids SSR hydration mismatch)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  // Countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);

  const matchIdRef = useRef<string | null>(null);
  useEffect(() => { matchIdRef.current = match?.matchId ?? null; }, [match?.matchId]);

  // True when a match-state poll fails — show a reconnecting strip instead of
  // silently freezing the board (a common cause of "we're not seeing the
  // same game").
  const [connLost, setConnLost] = useState(false);
  const refresh = useCallback(async () => {
    const id = matchIdRef.current;
    if (!id) return;
    try {
      const res = await fetch(`/api/quiz/match/${id}`, { headers: await authHeaders(), cache: "no-store" });
      if (!res.ok) { setConnLost(true); return; }
      const next = (await res.json()) as MatchState;
      setConnLost(false);
      setMatch(next);
      if (next.status === "completed") stopPolling();
    } catch {
      setConnLost(true);
    }
  }, [authHeaders]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // Poll the match while it's live
  useEffect(() => {
    if (!match || match.status === "completed") return;
    stopPolling();
    pollRef.current = setInterval(refresh, 3000);
    return stopPolling;
  }, [match?.matchId, match?.status, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Join via share link (/arena?join=<matchId>) ──────────────────────────
  const joinHandledRef = useRef(false);
  useEffect(() => {
    if (!user || joinHandledRef.current) return;
    const joinId = new URLSearchParams(window.location.search).get("join");
    if (!joinId) return;
    joinHandledRef.current = true;
    (async () => {
      const res = await fetch("/api/quiz/match/join", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ matchId: joinId }),
      });
      const json = (await res.json().catch(() => ({}))) as { matchId?: string; error?: string };
      if (!res.ok || !json.matchId) {
        setJoinError(json.error ?? "Could not join this duel");
        return;
      }
      window.history.replaceState({}, "", "/arena");
      const stateRes = await fetch(`/api/quiz/match/${json.matchId}`, { headers: await authHeaders(), cache: "no-store" });
      if (stateRes.ok) setMatch((await stateRes.json()) as MatchState);
      else setJoinError("You joined, but the game could not be opened — refresh Arena to continue.");
    })();
  }, [user, authHeaders]);

  // ── Duel presence + chat channel (per match, while not completed) ────────
  useEffect(() => {
    if (!user || !match || !match.isDuel || match.status === "completed") return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`duel-${match.matchId}`, { config: { presence: { key: user.id } } });
    chatChannelRef.current = channel;
    const oppId = match.oppId;
    channel
      .on("presence", { event: "sync" }, () => {
        const ids = new Set(Object.keys(channel.presenceState()));
        setOppOnline(oppId ? ids.has(oppId) : null);
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const msg = payload as ChatMsg;
        setChatMsgs((prev) => [...prev.slice(-99), msg]);
        if (!chatOpenRef.current && msg.user_id !== user.id) setChatUnread((n) => n + 1);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ user_id: user.id });
      });
    return () => {
      chatChannelRef.current = null;
      setOppOnline(null);
      setClaimIn(null);
      claimFiredRef.current = false;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, match?.matchId, match?.isDuel, match?.status]);

  useEffect(() => { oppSeenRef.current = match?.oppSeenAt ?? null; }, [match?.oppSeenAt]);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setChatUnread(0);
  }, [chatOpen]);

  // ── Opponent left? Count down to a claim-win ─────────────────────────────
  useEffect(() => {
    if (!match || match.status !== "active" || !match.isDuel || !match.oppId) {
      setClaimIn(null);
      return;
    }
    if (oppOnline !== false) {
      // They're here (or we haven't seen them yet) — stand down.
      setClaimIn(null);
      claimFiredRef.current = false;
      return;
    }
    const tick = () => {
      const seen = oppSeenRef.current;
      const age = seen ? (Date.now() - new Date(seen).getTime()) / 1000 : 9999;
      const remaining = Math.max(0, Math.ceil(CLAIM_GRACE_SECONDS - age));
      setClaimIn(remaining);
      if (remaining <= 0 && !claimFiredRef.current && Date.now() >= claimCooldownUntilRef.current) {
        claimFiredRef.current = true;
        void claimWin();
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.matchId, match?.status, match?.isDuel, match?.oppId, oppOnline]);

  async function claimWin() {
    if (!match) return;
    const res = await fetch(`/api/quiz/match/${match.matchId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "claim-win" }),
    });
    if (res.ok) { await refresh(); return; }
    // Server says the opponent is still around (or duel presence isn't
    // configured yet) — back off so we don't hammer the endpoint every second;
    // presence re-triggers the claim when it flips again.
    claimFiredRef.current = false;
    claimCooldownUntilRef.current = Date.now() + 10_000;
    setClaimIn(null);
  }

  // Reset per-match UI state when the match changes
  useEffect(() => {
    setSentInvites(new Set());
    setChatMsgs([]);
    setChatUnread(0);
    setChatOpen(false);
  }, [match?.matchId]);

  const shareUrl = match ? `${window.location.origin}/arena?join=${match.matchId}` : "";

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the input is selectable */ }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title: "Qubit duel", text: `Join my ${match?.subject ?? ""} duel on Qubit!`, url: shareUrl });
    } catch { /* user dismissed */ }
  }

  async function createMatch() {
    if (!subject) { setError("Pick a subject first."); return; }
    setCreating(true); setError("");
    const res = await fetch("/api/quiz/match", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ subject, mode: "duel", guestId }),
    });
    const json = (await res.json()) as { matchId?: string; error?: string };
    setCreating(false);
    if (!res.ok || !json.matchId) { setError(json.error ?? "Could not start the game."); return; }
    // Jump straight into the match screen
    const stateRes = await fetch(`/api/quiz/match/${json.matchId}`, { headers: await authHeaders(), cache: "no-store" });
    if (stateRes.ok) setMatch((await stateRes.json()) as MatchState);
    else setError("The game was created but could not be opened — try again.");
  }

  async function answer(choice: number) {
    if (!match || busy || match.currentTurn !== match.yourSide) return;
    setBusy(true);
    const res = await fetch(`/api/quiz/match/${match.matchId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ choice }),
    });
    const json = (await res.json()) as { correct?: boolean; skipped?: boolean };
    setLastResult(json.correct ? "correct" : "wrong");
    setTimeout(() => setLastResult(null), 1200);
    await refresh();
    setBusy(false);
  }

  async function skip() {
    if (!match || busy) return;
    setBusy(true);
    await fetch(`/api/quiz/match/${match.matchId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "skip" }),
    });
    await refresh();
    setBusy(false);
  }

  async function resign() {
    if (!match) return;
    const isLiveDuel = match.isDuel && match.status === "active";
    const msg = isLiveDuel
      ? "Leave this game? Your opponent wins immediately."
      : match.isDuel
        ? "Cancel this duel?"
        : "Cancel this game?";
    if (!window.confirm(msg)) return;
    stopPolling();
    await fetch(`/api/quiz/match/${match.matchId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "resign" }),
    });
    setMatch(null);
  }

  async function respondInvite(inv: InviteRow, accept: boolean) {
    setError("");
    const res = await fetch("/api/quiz/invite", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ inviteId: inv.id, accept }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not respond to this invite");
      void loadInvites(); // re-sync — the invite may have been cancelled server-side
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    if (!accept) return;
    // Accepting jumps straight into the game — fetch the match and open the board.
    const stateRes = await fetch(`/api/quiz/match/${inv.match_id}`, { headers: await authHeaders(), cache: "no-store" });
    if (stateRes.ok) setMatch((await stateRes.json()) as MatchState);
    else setError("You accepted, but the game could not be opened — open Arena again to continue.");
  }

  async function invitePlayer(toId: string) {
    if (!match) return;
    setSentInvites((prev) => new Set(prev).add(toId));
    const res = await fetch("/api/quiz/invite", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ matchId: match.matchId, toId }),
    });
    if (!res.ok) {
      setSentInvites((prev) => {
        const next = new Set(prev);
        next.delete(toId);
        return next;
      });
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text || !user || !chatChannelRef.current) return;
    const msg: ChatMsg = {
      id: crypto.randomUUID(),
      user_id: user.id,
      name: myName || "Player",
      text: text.slice(0, 300),
      at: new Date().toISOString(),
    };
    void chatChannelRef.current.send({ type: "broadcast", event: "chat", payload: msg });
    setChatMsgs((prev) => [...prev.slice(-99), msg]);
    setChatInput("");
  }

  // ── Live match screen (focus mode — no navigation, just the game) ────────
  if (match) {
    const myTurn = match.currentTurn === match.yourSide && match.status === "active" && !match.yourFinished;
    const secondsLeft = match.turnEndsAt ? Math.max(0, Math.ceil((new Date(match.turnEndsAt).getTime() - Date.now()) / 1000)) : null;
    const invitable = people.filter((p) => !sentInvites.has(p.id)).slice(0, 8);

    return (
      <AppShell focus>
        <div className="mx-auto max-w-2xl px-4 py-4 pb-24">
          {/* Top bar: subject · timer · leave */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">{match.subject}</span>
            <div className="flex items-center gap-2">
              {secondsLeft !== null && match.status === "active" && (
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums ${
                  secondsLeft <= 10 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                }`}>
                  <Timer className="h-4 w-4" aria-hidden /> {secondsLeft}s
                </span>
              )}
              <button type="button" onClick={resign}
                className="rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-black text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100">
                {match.isDuel && match.status === "active" ? "Leave" : match.isDuel ? "Cancel" : "End"}
              </button>
            </div>
          </div>

          {/* Connection lost — the board would otherwise silently freeze */}
          {connLost && (
            <div className="mb-3 rounded-2xl bg-rose-50 p-3 text-center text-xs font-black text-rose-700 ring-1 ring-rose-200">
              Connection lost — reconnecting to the duel…
            </div>
          )}

          {/* Scoreboard */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <ScoreCard label="You" score={match.yourScore} progress={`${match.yourIndex}/${match.total}`} highlight={myTurn} />
            <ScoreCard
              label={match.isDuel ? (match.oppName ? match.oppName.split(" ")[0] : "Opponent") : "Target"}
              score={match.oppScore}
              progress={match.isDuel ? `${match.oppIndex}/${match.total}` : `${match.total} questions`}
              highlight={!myTurn && match.status === "active"}
            />
          </div>

          {/* Opponent left — countdown to the win */}
          {claimIn !== null && match.status === "active" && (
            <div className="mb-4 rounded-[24px] bg-amber-50 p-4 text-center ring-1 ring-amber-200">
              <p className="text-sm font-black text-amber-800">
                {match.oppName ?? "Your opponent"} left the game — you win in {claimIn}s
              </p>
              <p className="mt-0.5 text-xs text-amber-700">If they come back, the duel continues where it left off.</p>
            </div>
          )}

          {match.status === "waiting" && (
            <div className="mb-4 rounded-[24px] bg-amber-50 p-5 ring-1 ring-amber-200">
              <p className="text-lg font-black text-amber-800">
                {match.oppName ? `Waiting for ${match.oppName} to accept…` : "Waiting for an opponent…"}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Share the link — anyone who opens it joins instantly. This page updates automatically.
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Duel share link"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 text-xs font-semibold text-slate-700"
                />
                <button type="button" onClick={() => void copyShareLink()}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-black text-white hover:bg-amber-700">
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {canNativeShare && (
                <button type="button" onClick={() => void nativeShare()}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline">
                  <Link2 className="h-3.5 w-3.5" aria-hidden /> Share via another app…
                </button>
              )}

              {invitable.length > 0 && (
                <div className="mt-4 border-t border-amber-200 pt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Invite players online</p>
                  <div className="space-y-1.5">
                    {invitable.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="relative shrink-0"><Avatar user={p} size="sm" /><OnlineDot userId={p.id} size={28} /></span>
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{p.full_name}</span>
                        <button type="button" onClick={() => void invitePlayer(p.id)}
                          className="rounded-full bg-violet-600 px-3.5 py-1 text-xs font-black text-white hover:bg-violet-700">
                          Invite
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {match.status === "completed" ? (
            <ResultScreen match={match} myId={user?.id ?? ""} onExit={() => setMatch(null)} />
          ) : (
            <>
              {/* Question */}
              {match.question && (
                <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
                  <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Question {match.yourIndex + 1} of {match.total}
                  </p>
                  <p className="text-lg font-semibold leading-7 text-slate-800">{match.question.prompt}</p>

                  <div className="mt-4 grid gap-2.5">
                    {match.question.options.map((opt, idx) => {
                      const reveal = match.answerKey?.find((a) => a.id === match.question!.id);
                      const isCorrect = reveal && reveal.answer === idx;
                      return (
                        <button key={idx} type="button"
                          onClick={() => answer(idx)}
                          disabled={!myTurn || busy}
                          className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition
                            ${isCorrect && match.status === "completed"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                              : !myTurn || busy
                                ? "border-slate-200 bg-white text-slate-400"
                                : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50"}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black
                            ${isCorrect && match.status === "completed" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="min-w-0 flex-1 break-words">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation after completion */}
                  {match.answerKey && match.answerKey.find((a) => a.id === match.question?.id)?.explanation && (
                    <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                      <ExplanationView text={match.answerKey.find((a) => a.id === match.question?.id)?.explanation ?? ""} subject={match.subject} className="mt-2" />
                    </div>
                  )}

                  {myTurn && (
                    <button type="button" onClick={skip} disabled={busy}
                      className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600">
                      Skip this question →
                    </button>
                  )}
                  {!myTurn && match.status === "active" && !match.yourFinished && (
                    <p className="mt-4 text-sm font-semibold text-slate-400">Opponent&apos;s turn — the board updates live.</p>
                  )}
                </div>
              )}

              {lastResult && (
                <div className={`mt-3 rounded-2xl p-3 text-center text-sm font-black ${lastResult === "correct" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                  {lastResult === "correct" ? "✓ Correct! +points coming at the end" : "✗ Wrong"}
                </div>
              )}
            </>
          )}

          {/* Chat — floating button + panel (duels only) */}
          {match.isDuel && match.status !== "completed" && (
            <>
              {!chatOpen && (
                <button type="button" onClick={() => setChatOpen(true)}
                  className="fixed bottom-4 right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-black text-white shadow-lg shadow-violet-400/40 hover:bg-violet-700">
                  <MessageCircle className="h-5 w-5" aria-hidden /> Chat
                  {chatUnread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </button>
              )}
              {chatOpen && (
                <div className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex h-[58vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[420px] sm:w-[360px] sm:rounded-[28px]">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">{match.oppName ?? "Duel chat"}</p>
                      <p className={`text-[10px] font-bold ${oppOnline ? "text-emerald-600" : "text-slate-400"}`}>
                        {oppOnline ? "In the game" : "Away"}
                      </p>
                    </div>
                    {match.oppId && !friendIds.has(match.oppId) && <FriendButton targetUserId={match.oppId} compact />}
                    <button type="button" onClick={() => setChatOpen(false)} aria-label="Close chat"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3">
                    {chatMsgs.length === 0 && (
                      <p className="mt-8 text-center text-xs text-slate-400">Say hi 👋 — chat is live and disappears when the game ends.</p>
                    )}
                    {chatMsgs.map((m) => (
                      <div key={m.id} className={`flex ${m.user_id === user?.id ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          m.user_id === user?.id ? "rounded-br-sm bg-violet-600 text-white" : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200"
                        }`}>
                          {m.user_id !== user?.id && <p className="text-[10px] font-black text-violet-500">{m.name}</p>}
                          <p className="break-words">{m.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                      placeholder="Type a message…"
                      maxLength={300}
                      className="h-10 min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-none placeholder:text-slate-400"
                    />
                    <button type="button" onClick={sendChat} disabled={!chatInput.trim()} aria-label="Send message"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white disabled:opacity-40">
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    );
  }

  // ── Lobby: subject + mode + opponent select ──────────────────────────────
  return (
    <AppShell title="Qubit Arena">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
              <Swords className="h-4 w-4" aria-hidden /> Qubit Arena
            </p>
            <h1 className="mt-2 text-3xl font-black">Quiz duels &amp; QPoints</h1>
            <p className="mt-2 max-w-md text-sm text-violet-100">
              Challenge anyone online — friend or not — or start a duel and share the link. Correct answers earn QPoints.
            </p>
            {myPoints !== null && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                <Zap className="h-4 w-4 text-[#f6c978]" aria-hidden /> {myPoints} QPoints (all time)
              </p>
            )}
          </div>

          {joinError && (
            <div className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
              {joinError}
            </div>
          )}

          {/* Pending duel invites */}
          {invites.length > 0 && (
            <div className="mb-5 rounded-[24px] bg-amber-50 p-4 ring-1 ring-amber-200">
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                Duel invites
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">{invites.length}</span>
              </p>
              {invites.map((inv) => (
                <div key={inv.id} className="mb-2 flex items-center gap-3 last:mb-0">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                    {inv.fromName} · {inv.subject ?? "Quiz"} duel
                  </span>
                  <button type="button" onClick={() => void respondInvite(inv, true)}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                    Accept
                  </button>
                  <button type="button" onClick={() => void respondInvite(inv, false)}
                    className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-300">
                    Decline
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Leaderboard + Achievements — big, impossible to miss */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/leaderboard"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-sm font-black text-amber-950 shadow-lg shadow-amber-200/70 transition hover:brightness-105">
              <Trophy className="h-5 w-5" aria-hidden /> Leaderboard
            </Link>
            <Link href="/achievements"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 text-sm font-black text-white shadow-lg shadow-violet-300/50 transition hover:brightness-105">
              <Award className="h-5 w-5" aria-hidden /> Achievements
            </Link>
          </div>

          {/* Mode switch — DUEL only, solo removed */}
          <div className="mb-5 rounded-[24px] bg-gradient-to-r from-violet-600 to-violet-500 p-5 text-white">
            <p className="flex items-center gap-2 text-sm font-black">
              <Users className="h-5 w-5" aria-hidden /> Duel mode — 10 questions, 10s per turn
            </p>
            <p className="mt-1 text-xs text-violet-200">
              Challenge a friend or share an open link. First to finish with the most correct answers wins.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-violet-100">
              <span className="rounded-full bg-white/15 px-2.5 py-1">Win bonus: +25 QPoints</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">+10 per correct</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">+5 participation</span>
            </div>
          </div>

          {/* Subject — dropdown */}
          <label htmlFor="arena-subject" className="mb-2 block text-sm font-bold text-slate-700">Pick a subject</label>
          <select
            id="arena-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mb-4 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="" disabled>Choose a subject…</option>
            {subjects.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Online players — anyone, not just friends */}
          {people.length > 0 && (
            <div className="mb-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Online now — tap to challenge
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {people.map((p) => (
                  <div key={p.id}
                    className={`flex items-center gap-2.5 rounded-2xl border p-2.5 transition ${guestId === p.id ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>
                    <button type="button" onClick={() => setGuestId(p.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="relative shrink-0"><Avatar user={p} size="sm" /><OnlineDot userId={p.id} size={28} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{p.full_name}</span>
                        <span className="flex items-center gap-1.5">
                          {friendIds.has(p.id) && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">Friend</span>
                          )}
                          {p.user_code && <span className="text-[11px] text-slate-400">{p.user_code}</span>}
                        </span>
                      </span>
                      {guestId === p.id && <Crown className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />}
                    </button>
                    <Link href={`/messages/${p.id}`} aria-label={`Message ${p.full_name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    </Link>
                    {!friendIds.has(p.id) && <FriendButton targetUserId={p.id} compact />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends (offline friends can still be invited) */}
          <div className="mb-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Invite a friend</p>
              {!friendsLoaded ? (
                <p className="text-sm text-slate-400">Loading friends…</p>
              ) : friends.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No friends yet — challenge someone from the online list above, or add people from the{" "}
                  <Link href="/community" className="font-bold text-violet-600">community</Link>.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {friends.map((f) => {
                    const other = f.requester_id === user?.id ? f.addressee : f.requester;
                    const fid = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                    if (!other) return null;
                    const isOnline = onlineUsers.has(fid);
                    return (
                      <button key={f.id} type="button" onClick={() => setGuestId(fid)}
                        className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${guestId === fid ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                        <span className="relative shrink-0"><Avatar user={{ full_name: other.full_name, avatar_url: other.avatar_url ?? null }} size="sm" /><OnlineDot userId={fid} size={28} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{other.full_name}</span>
                          <span className="block text-[11px] text-slate-400">{isOnline ? "Online now" : "Offline — invite by DM"}</span>
                        </span>
                        {guestId === fid && <Crown className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>

          {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}

          <button type="button" onClick={() => void createMatch()} disabled={creating}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700 disabled:opacity-50">
            {creating
              ? "Setting up the board…"
              : guestId
                ? "Send duel invite"
                : "Create duel & share link"}
          </button>

          {/* How QPoints work */}
          <div className="mt-6 rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="text-sm font-black text-slate-900">How QPoints work</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>• Duel win: 25 bonus + 5 participation + 10 per correct answer</li>
              <li>• Both players keep 5 + 10 per correct answer even when you lose</li>
              <li>• Leave or forfeit a live duel: you earn 0 — your opponent takes the win</li>
              <li>• Games that never finish (abandoned/expired) pay nothing</li>
              <li>• Daily cap: 300 QPoints · Leaderboard resets weekly</li>
            </ul>
          </div>
        </div>
      </AuthGuard>
    </AppShell>
  );
}

function ScoreCard({ label, score, progress, highlight }: { label: string; score: number; progress: string; highlight: boolean }) {
  return (
    <div className={`rounded-[24px] p-4 ring-1 transition ${highlight ? "bg-violet-600 text-white ring-violet-600 shadow-lg shadow-violet-200" : "bg-white ring-slate-200"}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${highlight ? "text-violet-200" : "text-slate-400"}`}>{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums">{score}</p>
      <p className={`text-xs font-semibold ${highlight ? "text-violet-200" : "text-slate-400"}`}>{progress}</p>
    </div>
  );
}

function ResultScreen({ match, myId, onExit }: { match: MatchState; myId: string; onExit: () => void }) {
  const won = match.winnerId === myId;
  const tie = match.winnerId === null;
  return (
    <div className={`rounded-[28px] p-6 text-center text-white ${won ? "bg-gradient-to-br from-emerald-700 to-emerald-500" : tie ? "bg-gradient-to-br from-slate-700 to-slate-500" : "bg-gradient-to-br from-rose-700 to-rose-500"}`}>
      <Trophy className="mx-auto h-10 w-10" aria-hidden />
      <h2 className="mt-3 text-3xl font-black">
        {match.isDuel ? (won ? "You win! 🏆" : tie ? "It's a draw" : "So close!") : "Drill complete!"}
      </h2>
      <p className="mt-1 text-sm opacity-90">
        Final score {match.yourScore} – {match.oppScore} · {match.subject}
      </p>
      <p className="mt-3 text-xs opacity-80">
        {match.isDuel && !tie
          ? won
            ? "Win bonus + points added — check the leaderboard."
            : "QPoints settled by the result — win next time for the 25-point bonus."
          : "QPoints have been added to your ledger — check the leaderboard."}
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <button type="button" onClick={onExit}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100">
          Play again
        </button>
        <Link href="/leaderboard" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
