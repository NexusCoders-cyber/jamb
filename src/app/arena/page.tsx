"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import ExplanationView from "@/components/ExplanationView";
import { getMyFriendships, type Friendship } from "@/lib/queries";
import { Swords, Users, Timer, Trophy, Play, Crown, Zap } from "lucide-react";

const TURN_SECONDS = 45;

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
];

export default function ArenaPage() {
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  // Setup
  const [subjects] = useState(ARENA_SUBJECTS);
  const [subject, setSubject] = useState("");
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [mode, setMode] = useState<"solo" | "duel">("solo");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Live match
  const [match, setMatch] = useState<MatchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | "timeout" | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Invites
  const [invites, setInvites] = useState<Array<{ id: string; match_id: string; subject: string | null; fromName: string }>>([]);
  const [myPoints, setMyPoints] = useState<number | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }, []);

  // Load friends + pending invites + my points
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    getMyFriendships(supabase, user.id).then((rows) => {
      setFriends(rows.filter((r) => r.status === "accepted"));
      setFriendsLoaded(true);
    });
    supabase
      .from("quiz_invites")
      .select("id, match_id, subject, from:profiles!quiz_invites_from_id_fkey(full_name)")
      .eq("to_id", user.id)
      .eq("status", "pending")
      .then(({ data }) => {
        const rows = ((data ?? []) as unknown) as Array<{ id: string; match_id: string; subject: string | null; from: { full_name: string } }>;
        setInvites(rows.map((r) => ({ id: r.id, match_id: r.match_id, subject: r.subject, fromName: r.from?.full_name ?? "A student" })));
      });
    supabase.rpc("my_total_points", { p_user: user.id }).then(({ data }) => setMyPoints(Number(data ?? 0)));
  }, [user]);

  // Countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    if (!match) return;
    const res = await fetch(`/api/quiz/match/${match.matchId}`, { headers: await authHeaders(), cache: "no-store" });
    if (res.ok) {
      const next = (await res.json()) as MatchState;
      setMatch(next);
      if (next.status === "completed") stopPolling();
    }
  }, [match, authHeaders]);

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

  async function createMatch(m: "solo" | "duel") {
    if (!subject) { setError("Pick a subject first."); return; }
    if (m === "duel" && !guestId) { setError("Choose a friend to duel."); return; }
    setCreating(true); setError("");
    const res = await fetch("/api/quiz/match", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ subject, mode: m, guestId: m === "duel" ? guestId : null }),
    });
    const json = (await res.json()) as { matchId?: string; error?: string };
    setCreating(false);
    if (!res.ok || !json.matchId) { setError(json.error ?? "Could not start the game."); return; }
    // Jump straight into the match screen
    const stateRes = await fetch(`/api/quiz/match/${json.matchId}`, { headers: await authHeaders(), cache: "no-store" });
    if (stateRes.ok) setMatch((await stateRes.json()) as MatchState);
    if (m === "duel") router.refresh();
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
    if (!window.confirm("Leave this game? In a duel your opponent wins.")) return;
    stopPolling();
    await fetch(`/api/quiz/match/${match.matchId}`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "resign" }),
    });
    setMatch(null);
  }

  async function respondInvite(inviteId: string, accept: boolean) {
    await fetch("/api/quiz/invite", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ inviteId, accept }),
    });
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    if (accept) {
      // The accepted match opens — find it via notifications link or reload state
      window.location.reload();
    }
  }

  const acceptedMatchId = typeof window !== "undefined" ? sessionStorage.getItem("arena_open_match") : null;

  // ── Live match screen ────────────────────────────────────────────────────
  if (match) {
    const myTurn = match.currentTurn === match.yourSide && match.status === "active" && !match.yourFinished;
    const secondsLeft = match.turnEndsAt ? Math.max(0, Math.ceil((new Date(match.turnEndsAt).getTime() - Date.now()) / 1000)) : null;

    return (
      <AppShell title="Qubit Arena" back="/arena">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* Scoreboard */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <ScoreCard label="You" score={match.yourScore} progress={`${match.yourIndex}/${match.total}`} highlight={myTurn} />
            <ScoreCard
              label={match.isDuel ? "Opponent" : "Target"}
              score={match.oppScore}
              progress={match.isDuel ? `${match.oppIndex}/${match.total}` : `${match.total} questions`}
              highlight={!myTurn && match.status === "active"}
            />
          </div>

          {match.status === "waiting" && (
            <div className="mb-4 rounded-[24px] bg-amber-50 p-5 text-center ring-1 ring-amber-200">
              <p className="text-lg font-black text-amber-800">Waiting for your opponent…</p>
              <p className="mt-1 text-sm text-amber-700">They&apos;ll see the invite in their Arena. This page updates automatically.</p>
            </div>
          )}

          {match.status === "completed" ? (
            <ResultScreen match={match} myId={user?.id ?? ""} onExit={() => setMatch(null)} />
          ) : (
            <>
              {/* Subject + timer */}
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">{match.subject}</span>
                {secondsLeft !== null && match.status === "active" && (
                  <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums ${
                    secondsLeft <= 10 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    <Timer className="h-4 w-4" aria-hidden /> {secondsLeft}s
                  </span>
                )}
              </div>

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

              <button type="button" onClick={resign}
                className="mt-4 w-full rounded-2xl border border-rose-200 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50">
                {match.isDuel ? "Forfeit duel" : "End game"}
              </button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  // ── Lobby: subject + mode select ─────────────────────────────────────────
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
              Challenge friends to millionaire-style duels or train solo. Correct answers earn QPoints — top the weekly leaderboard!
            </p>
            {myPoints !== null && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">
                <Zap className="h-4 w-4 text-[#f6c978]" aria-hidden /> {myPoints} QPoints (all time)
              </p>
            )}
          </div>

          {/* Pending duel invites */}
          {invites.length > 0 && (
            <div className="mb-5 rounded-[24px] bg-amber-50 p-4 ring-1 ring-amber-200">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-700">Duel invites</p>
              {invites.map((inv) => (
                <div key={inv.id} className="mb-2 flex items-center gap-3 last:mb-0">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
                    {inv.fromName} · {inv.subject ?? "Quiz"} duel
                  </span>
                  <button type="button" onClick={() => respondInvite(inv.id, true)}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
                    Accept
                  </button>
                  <button type="button" onClick={() => respondInvite(inv.id, false)}
                    className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-300">
                    Decline
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mode switch */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setMode("solo")}
              className={`rounded-[24px] p-4 text-left ring-2 transition ${mode === "solo" ? "bg-violet-50 ring-violet-500" : "bg-white ring-slate-200"}`}>
              <Play className="h-5 w-5 text-violet-600" aria-hidden />
              <p className="mt-2 text-base font-black text-slate-900">Solo drill</p>
              <p className="text-xs text-slate-500">10 questions, 8 QPoints per correct answer</p>
            </button>
            <button type="button" onClick={() => setMode("duel")}
              className={`rounded-[24px] p-4 text-left ring-2 transition ${mode === "duel" ? "bg-violet-50 ring-violet-500" : "bg-white ring-slate-200"}`}>
              <Users className="h-5 w-5 text-violet-600" aria-hidden />
              <p className="mt-2 text-base font-black text-slate-900">Duel a friend</p>
              <p className="text-xs text-slate-500">Turn-based, 45s per turn · win bonus 25</p>
            </button>
          </div>

          {/* Subjects */}
          <p className="mb-2 text-sm font-bold text-slate-700">Pick a subject</p>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {subjects.map((s) => (
              <button key={s.name} type="button" onClick={() => setSubject(s.name)}
                className={`rounded-2xl border p-3 text-sm font-bold transition ${subject === s.name ? "border-violet-500 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"}`}>
                {s.name.replace(" Language", "")}
              </button>
            ))}
          </div>

          {/* Friend picker for duels */}
          {mode === "duel" && (
            <div className="mb-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Choose your opponent</p>
              {!friendsLoaded ? (
                <p className="text-sm text-slate-400">Loading friends…</p>
              ) : friends.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No friends yet — add people from the <Link href="/community" className="font-bold text-violet-600">community</Link> or their profiles first.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {friends.map((f) => {
                    const other = f.requester_id === user?.id ? f.addressee : f.requester;
                    const fid = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                    if (!other) return null;
                    return (
                      <button key={f.id} type="button" onClick={() => setGuestId(fid)}
                        className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${guestId === fid ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300"}`}>
                        <Avatar user={{ full_name: other.full_name, avatar_url: other.avatar_url ?? null }} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{other.full_name}</span>
                          {other.user_code && <span className="block text-[11px] text-slate-400">{other.user_code}</span>}
                        </span>
                        {guestId === fid && <Crown className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}

          <button type="button" onClick={() => createMatch(mode)} disabled={creating}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-base font-black text-white shadow-lg shadow-violet-300/30 transition hover:bg-violet-700 disabled:opacity-50">
            {creating ? "Setting up the board…" : mode === "solo" ? "Start solo drill" : "Send duel invite"}
          </button>

          <div className="mt-4 flex justify-center gap-4 text-xs font-bold">
            <Link href="/leaderboard" className="text-violet-600 hover:underline">Weekly leaderboard →</Link>
            <Link href="/achievements" className="text-violet-600 hover:underline">Achievements →</Link>
          </div>

          {/* How QPoints work */}
          <div className="mt-6 rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
            <p className="text-sm font-black text-slate-900">How QPoints work</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>• Duel win: 25 bonus · participation: 5 · +10 per correct answer</li>
              <li>• Solo drill: +8 per correct answer</li>
              <li>• Daily earning cap: 300 QPoints — play fair, climb the weekly board</li>
              <li>• Leaderboard resets weekly (set by admins)</li>
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
      <p className="mt-3 text-xs opacity-80">QPoints have been added to your ledger — check the leaderboard.</p>
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
