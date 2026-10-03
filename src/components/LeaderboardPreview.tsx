"use client";

/**
 * LeaderboardPreview — "Top players this week" card for the Arena home.
 * Shows the top 3 and the signed-in player's own rank, with a link to the full board.
 * Quietly renders nothing if the leaderboard can't be loaded (e.g. SQL not run yet),
 * so the Arena itself is never blocked by it.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Trophy, Zap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Avatar from "@/components/Avatar";
import OnlineDot from "@/components/OnlineDot";

type Row = {
  rank: number;
  user_id: string;
  full_name: string;
  user_code: string | null;
  avatar_url: string | null;
  points: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPreview({ userId }: { userId: string | undefined }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch("/api/quiz/leaderboard", {
          headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { rows?: Row[] };
        if (alive) setRows(json.rows ?? []);
      } catch {
        /* optional card — stay hidden */
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  if (rows === null) return null;

  const top = rows.slice(0, 3);
  const me = rows.find((r) => r.user_id === userId);
  const meBelowTop = me && me.rank > 3;

  return (
    <section className="mt-4 rounded-[24px] bg-white p-4 ring-1 ring-slate-200 shadow-sm" aria-label="Top players this week">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Top players this week
        </h2>
        <Link href="/leaderboard" className="inline-flex min-h-9 items-center gap-0.5 text-xs font-bold text-violet-600">
          Full board <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">No QPoints yet this week — win a duel to take the first spot.</p>
      ) : (
        <ol className="space-y-2">
          {top.map((r) => {
            const isMe = r.user_id === userId;
            return (
              <li key={r.user_id}>
                <Link
                  href={`/profile/${r.user_id}`}
                  className={`flex min-h-12 touch-manipulation items-center gap-3 rounded-2xl px-3 py-2 ${isMe ? "bg-violet-50 ring-2 ring-violet-500" : "bg-slate-50"}`}
                >
                  <span className="w-6 shrink-0 text-center text-lg" aria-hidden>{MEDALS[r.rank - 1]}</span>
                  <span className="relative block shrink-0">
                    <Avatar user={{ full_name: r.full_name, avatar_url: r.avatar_url }} size="md" />
                    <OnlineDot userId={r.user_id} size={36} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">
                    {r.full_name.split(" ")[0]}{isMe ? " (you)" : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-black text-violet-700">
                    <Zap className="h-3.5 w-3.5 text-[#d9c14a]" aria-hidden /> {r.points.toLocaleString("en-NG")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {meBelowTop && me && (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-center text-xs font-bold text-violet-800">
          You&apos;re #{me.rank} with {me.points.toLocaleString("en-NG")} pts — win duels to climb.
        </p>
      )}
      {!me && top.length > 0 && (
        <p className="mt-3 text-center text-xs font-semibold text-slate-500">Play a duel to get on the board.</p>
      )}
    </section>
  );
}
