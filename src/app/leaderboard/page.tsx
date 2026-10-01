"use client";

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

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <AppShell title="Leaderboard">
      <AuthGuard user={user} loading={authLoading}>
        <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
          <div className="mb-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-6 text-white shadow-xl shadow-violet-300/25">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
              <Zap className="h-4 w-4 text-[#f6c978]" aria-hidden /> Weekly QPoints
            </p>
            <h1 className="mt-2 text-3xl font-black">Leaderboard</h1>
            {since && <p className="mt-1 text-sm text-violet-100">Since {new Date(since).toLocaleDateString("en-NG", { day: "numeric", month: "long" })} · resets weekly</p>}
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-[24px] bg-slate-100" />)}</div>
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
              {/* Podium */}
              <div className="mb-5 grid grid-cols-3 items-end gap-3">
                {[1, 0, 2].map((pos) => {
                  const row = podium[pos];
                  if (!row) return <div key={pos} />;
                  const heights = ["h-24", "h-20", "h-16"];
                  return (
                    <Link key={row.user_id} href={`/profile/${row.user_id}`}
                      className={`flex flex-col items-center justify-end rounded-[24px] p-3 text-center ring-1 transition hover:ring-violet-300 ${pos === 0 ? "bg-gradient-to-b from-amber-100 to-white ring-amber-300" : "bg-white ring-slate-200"} ${heights[pos]}`}>
                      <span className="text-xl">{pos === 0 ? "🥇" : pos === 1 ? "🥈" : "🥉"}</span>
                      <span className="relative block"><Avatar user={{ full_name: row.full_name, avatar_url: row.avatar_url }} size="sm" /><OnlineDot userId={row.user_id} size={28} /></span>
                      <p className="mt-1 w-full truncate text-xs font-black text-slate-900">{row.full_name.split(" ")[0]}</p>
                      {row.user_code && <p className="w-full truncate font-mono text-[10px] text-slate-400">{row.user_code}</p>}
                      <p className="text-xs font-black text-violet-700">{row.points} pts</p>
                    </Link>
                  );
                })}
              </div>

              {/* Ranked list */}
              <div className="space-y-2">
                {rest.map((row) => {
                  const isMe = row.user_id === user?.id;
                  return (
                    <Link key={row.user_id} href={`/profile/${row.user_id}`}
                      className={`flex items-center gap-3 rounded-[24px] p-3.5 ring-1 transition ${isMe ? "bg-violet-50 ring-violet-300" : "bg-white ring-slate-200 hover:ring-violet-200"}`}>
                      <span className={`w-8 text-center text-sm font-black ${row.rank <= 3 ? "text-amber-600" : "text-slate-400"}`}>#{row.rank}</span>
                      <span className="relative block"><Avatar user={{ full_name: row.full_name, avatar_url: row.avatar_url }} size="sm" /><OnlineDot userId={row.user_id} size={28} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-900">{row.full_name}{isMe ? " (you)" : ""}</span>
                          {row.user_code && <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-500 sm:inline">{row.user_code}</span>}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-sm font-black text-violet-700">
                        <Zap className="h-4 w-4 text-[#d9c14a]" aria-hidden /> {row.points}
                      </span>
                    </Link>
                  );
                })}
              </div>

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
