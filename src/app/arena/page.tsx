"use client";

/**
 * Leaderboard — weekly QPoints ranking, shown as a horizontal Top 10 rail
 * (swipe through the top players like stories on social apps).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";
import { Crown, Medal, RefreshCw, Zap, Swords } from "lucide-react";

type Row = {
  rank: number;
  user_id: string;
  full_name: string;
  user_code: string | null;
  avatar_url: string | null;
  points: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

const LIST_STEP = 25;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "Resets in 3 days" — only when the period start is a real weekly boundary still ahead of us. */
function resetsIn(since: string): string | null {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return null;
  const ms = start + WEEK_MS - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Resets in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `Resets in ${hours}h`;
}

function PodiumSpot({ row, isMe, place }: { row: Row; isMe: boolean; place: 1 | 2 | 3 }) {
  const first = place === 1;
  const pedestalHeight = first ? "h-16" : place === 2 ? "h-12" : "h-9";
  // Inline gradients so the gold / silver / bronze stay bright in dark mode as well
  const pedestalFill = first
    ? "linear-gradient(to bottom, #fcd34d, #fbbf24)"
    : place === 2
      ? "linear-gradient(to bottom, #cbd5e1, #94a3b8)"
      : "linear-gradient(to bottom, #fdba74, #fb923c)";
  return (
    <Link
      href={`/profile/${row.user_id}`}
      className="flex min-w-0 flex-col items-center text-center active:scale-[0.98]"
      aria-label={`Rank ${place}: ${row.full_name}, ${row.points} points`}
    >
      {first && <Crown className="mb-1 h-6 w-6 text-amber-500" aria-hidden />}
      <span className="relative block">
        <Avatar user={{ full_name: row.full_name, avatar_url: row.avatar_url }} size={first ? "xl" : "lg"} className={isMe ? "ring-2 ring-violet-500" : ""} />
        <OnlineDot userId={row.user_id} size={first ? 80 : 44} />
      </span>
      <p className="mt-2 w-full truncate px-1 text-sm font-black text-slate-900">
        {row.full_name.split(" ")[0]}{isMe ? " (you)" : ""}
      </p>
      <p className="flex items-center gap-1 text-xs font-black text-violet-700">
        <Zap className="h-3.5 w-3.5 text-[#d9c14a]" aria-hidden /> {row.points.toLocaleString("en-NG")}
      </p>
      <div className={`mt-2 flex w-full items-start justify-center rounded-t-2xl pt-1.5 ${pedestalHeight}`} style={{ background: pedestalFill }}>
        <span className="text-xl" aria-hidden>{MEDALS[place - 1]}</span>
      </div>
    </Link>
  );
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [since, setSince] = useState<string>("");
  const [visible, setVisible] = useState(LIST_STEP);

  const load = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/quiz/leaderboard", {
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { rows?: Row[]; since?: string; error?: string };
      if (!res.ok) setError(json.error ?? "Could not load the leaderboard.");
      else {
        setError("");
        setRows(json.rows ?? []);
        setSince(json.since ?? "");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => void load(), 0); // first load, off the effect's synchronous path
    return () => clearTimeout(t);
  }, [user, load]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const me = rows.find((r) => r.user_id === user?.id);
  const above = me && me.rank > 1 ? rows[me.rank - 2] : null;
  const gap = me && above ? Math.max(above.points - me.points + 1, 1) : 0;
  const resets = since ? resetsIn(since) : null;
  // Classic podium order: 2nd – 1st – 3rd
  const podiumOrder: Array<{ row: Row; place: 1 | 2 | 3 }> = [
    podium[1] && { row: podium[1], place: 2 as const },
    podium[0] && { row: podium[0], place: 1 as const },
    podium[2] && { row: podium[2], place: 3 as const },
  ].filter(Boolean) as Array<{ row: Row; place: 1 | 2 | 3 }>;

  return (
    <AppShell title="Leaderboard">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-xl shadow-violet-300/25">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
                <Zap className="h-4 w-4 text-[#f6c978]" aria-hidden /> Weekly QPoints
              </p>
              <button
                type="button"
                onClick={() => { setRefreshing(true); void load(); }}
                disabled={refreshing || loading}
                aria-label="Refresh leaderboard"
                className="-mr-2 -mt-2 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-violet-100 active:bg-white/10 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              </button>
            </div>
            <h1 className="mt-1 text-3xl font-black">Weekly Leaderboard</h1>
            {since && (
              <p className="mt-1 text-sm text-violet-100">
                Since {new Date(since).toLocaleDateString("en-NG", { day: "numeric", month: "long" })} · resets weekly{resets ? ` · ${resets}` : ""}
              </p>
            )}

            {/* Your standing — always visible, whether you're #1 or #60 */}
            {me && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-black">#{me.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">
                    {me.rank === 1 ? "You're leading the week! 🏆" : `You're #${me.rank} of ${rows.length}`}
                  </p>
                  <p className="truncate text-xs font-semibold text-violet-100">
                    {me.points.toLocaleString("en-NG")} pts
                    {above ? ` · ${gap} more to pass ${above.full_name.split(" ")[0]}` : ""}
                  </p>
                </div>
                <Link href="/arena" className="inline-flex min-h-10 shrink-0 touch-manipulation items-center rounded-full bg-white px-4 text-xs font-black text-violet-700 active:scale-[0.98]" style={{ backgroundColor: "#ffffff", color: "#5b21b6" }}>
                  Play
                </Link>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <div className="grid grid-cols-3 items-end gap-2">
                {[44, 60, 36].map((h, i) => <div key={i} className="animate-pulse rounded-t-2xl bg-slate-100" style={{ height: h + 96 }} />)}
              </div>
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}
            </div>
          ) : error ? (
            <div className="rounded-[24px] bg-rose-50 p-6 text-center ring-1 ring-rose-200">
              <p className="text-sm font-bold text-rose-700">{error}</p>
              <p className="mt-1 text-xs text-rose-500">Ask an admin to run supabase/quiz_qpoints.sql in the Supabase dashboard.</p>
              <button
                type="button"
                onClick={() => { setLoading(true); setError(""); void load(); }}
                className="mt-4 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-bold text-white active:scale-[0.98]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-900">No QPoints yet this week</p>
              <p className="mt-1 text-sm text-slate-500">Play in the Arena to claim the top spot.</p>
              <Link href="/arena" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700">
                <Swords className="h-4 w-4" aria-hidden /> Enter the Arena
              </Link>
            </div>
          ) : (
            <>
              {/* Podium — top 3 */}
              <div className="mb-5 rounded-[28px] bg-gradient-to-b from-amber-50 to-white px-3 pt-5 ring-1 ring-amber-200">
                <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">Top players this week</p>
                <div className={`grid items-end gap-2 ${podiumOrder.length === 3 ? "grid-cols-3" : podiumOrder.length === 2 ? "grid-cols-2" : "grid-cols-1 mx-auto max-w-[9rem]"}`}>
                  {podiumOrder.map(({ row, place }) => (
                    <PodiumSpot key={row.user_id} row={row} isMe={row.user_id === user?.id} place={place} />
                  ))}
                </div>
              </div>

              {/* Rank 4 and below */}
              {rest.length > 0 && (
                <ol className="space-y-2">
                  {rest.slice(0, visible).map((row) => {
                    const isMe = row.user_id === user?.id;
                    return (
                      <li key={row.user_id}>
                        <Link
                          href={`/profile/${row.user_id}`}
                          className={`flex min-h-16 touch-manipulation items-center gap-3 rounded-2xl p-3 ring-1 transition active:scale-[0.99] ${
                            isMe ? "bg-violet-50 ring-2 ring-violet-500" : "bg-white ring-slate-200 hover:ring-violet-300"
                          }`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
                            #{row.rank}
                          </span>
                          <span className="relative block shrink-0">
                            <Avatar user={{ full_name: row.full_name, avatar_url: row.avatar_url }} size="lg" />
                            <OnlineDot userId={row.user_id} size={44} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {row.full_name.split(" ")[0]}{isMe ? " (you)" : ""}
                            </span>
                            {row.user_code && <span className="block truncate font-mono text-[10px] text-slate-400">{row.user_code}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-1 text-sm font-black text-violet-700">
                            <Zap className="h-4 w-4 text-[#d9c14a]" aria-hidden /> {row.points.toLocaleString("en-NG")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
              {rest.length > visible && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + LIST_STEP)}
                  className="mt-3 flex min-h-11 w-full touch-manipulation items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-700 active:scale-[0.99]"
                >
                  Show more ({rest.length - visible} more)
                </button>
              )}

              {!me && (
                <div className="mt-4 rounded-[24px] bg-white p-4 text-center ring-1 ring-slate-200">
                  <p className="text-sm font-bold text-slate-700">
                    You&apos;re not on the board yet — <Link href="/arena" className="text-violet-600 underline">play in the Arena</Link> to enter the ranking.
                  </p>
                </div>
              )}

              <p className="mt-5 text-center text-xs text-slate-400">
                <Crown className="mr-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
                Rankings show name, ID and weekly QPoints · <Medal className="inline h-3.5 w-3.5" aria-hidden /> achievement points count too
              </p>
            </>
          )}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
