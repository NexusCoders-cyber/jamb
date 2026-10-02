"use client";

/**
 * Leaderboard — weekly QPoints ranking, shown as a horizontal Top 10 rail
 * (swipe through the top players like stories on social apps).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";
import { Crown, Medal, Zap, Swords } from "lucide-react";

type Row = {
  rank: number;
  user_id: string;
  full_name: string;
  user_code: string | null;
  avatar_url: string | null;
  points: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useUser();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [since, setSince] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/quiz/leaderboard", {
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
        cache: "no-store",
      });
      const json = (await res.json()) as { rows?: Row[]; since?: string; error?: string };
      if (!res.ok) setError(json.error ?? "Could not load the leaderboard.");
      else {
        setRows(json.rows ?? []);
        setSince(json.since ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const top10 = rows.slice(0, 10);
  const me = rows.find((r) => r.user_id === user?.id);
  const meOutsideTop10 = me && me.rank > 10;

  return (
    <AppShell title="Leaderboard">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
              <Zap className="h-4 w-4 text-[#f6c978]" aria-hidden /> Weekly QPoints
            </p>
            <h1 className="mt-2 text-3xl font-black">Top 10 Leaderboard</h1>
            {since && <p className="mt-1 text-sm text-violet-100">Since {new Date(since).toLocaleDateString("en-NG", { day: "numeric", month: "long" })} · resets weekly</p>}
          </div>

          {loading ? (
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-52 w-40 shrink-0 animate-pulse rounded-[24px] bg-slate-100" />)}
            </div>
          ) : error ? (
            <div className="rounded-[24px] bg-rose-50 p-6 text-center ring-1 ring-rose-200">
              <p className="text-sm font-bold text-rose-700">{error}</p>
              <p className="mt-1 text-xs text-rose-500">Ask an admin to run supabase/quiz_qpoints.sql in the Supabase dashboard.</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[24px] bg-white p-10 text-center ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-900">No QPoints yet this week</p>
              <p className="mt-1 text-sm text-slate-500">Play in the Arena to claim the top spot.</p>
              <Link href="/arena" className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
                <Swords className="h-4 w-4" aria-hidden /> Enter the Arena
              </Link>
            </div>
          ) : (
            <>
              {/* Top 10 — horizontal rail */}
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:-mx-6 lg:px-6">
                {top10.map((row) => {
                  const isMe = row.user_id === user?.id;
                  return (
                    <Link key={row.user_id} href={`/profile/${row.user_id}`}
                      className={`flex w-40 shrink-0 snap-start flex-col items-center rounded-[24px] p-4 text-center ring-2 transition ${
                        isMe
                          ? "bg-violet-50 ring-violet-500"
                          : row.rank <= 3
                            ? "bg-gradient-to-b from-amber-50 to-white ring-amber-300"
                            : "bg-white ring-slate-200 hover:ring-violet-300"
                      }`}>
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                        row.rank <= 3 ? "bg-amber-100" : "bg-slate-100 text-slate-500"
                      }`}>
                        {row.rank <= 3 ? MEDALS[row.rank - 1] : `#${row.rank}`}
                      </span>
                      <span className="relative mt-2 block">
                        <Avatar user={{ full_name: row.full_name, avatar_url: row.avatar_url }} size="lg" />
                        <OnlineDot userId={row.user_id} size={48} />
                      </span>
                      <p className="mt-2 w-full truncate text-sm font-black text-slate-900">
                        {row.full_name.split(" ")[0]}{isMe ? " (you)" : ""}
                      </p>
                      {row.user_code && <p className="w-full truncate font-mono text-[10px] text-slate-400">{row.user_code}</p>}
                      <p className="mt-1 flex items-center gap-1 text-sm font-black text-violet-700">
                        <Zap className="h-4 w-4 text-[#d9c14a]" aria-hidden /> {row.points} pts
                      </p>
                    </Link>
                  );
                })}
              </div>
              <p className="mb-5 text-center text-[11px] text-slate-400">← swipe to see the whole top 10 →</p>

              {/* Where am I? */}
              {meOutsideTop10 && (
                <div className="mb-4 flex items-center gap-3 rounded-[24px] bg-violet-50 p-4 ring-1 ring-violet-200">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">#{me.rank}</span>
                  <p className="min-w-0 flex-1 text-sm font-bold text-violet-900">
                    You&apos;re #{me.rank} with {me.points} pts — win duels to reach the top 10!
                  </p>
                  <Link href="/arena" className="shrink-0 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-violet-700">
                    Play
                  </Link>
                </div>
              )}
              {!me && (
                <div className="mb-4 rounded-[24px] bg-white p-4 text-center ring-1 ring-slate-200">
                  <p className="text-sm font-bold text-slate-700">
                    You&apos;re not on the board yet — <Link href="/arena" className="text-violet-600 underline">play in the Arena</Link> to enter the ranking.
                  </p>
                </div>
              )}

              <p className="mt-2 text-center text-xs text-slate-400">
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
