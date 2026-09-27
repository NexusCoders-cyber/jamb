"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { getUserAttempts } from "@/lib/queries";

type Drill = { label: string; score: string };

export default function SpeedTrainingPage() {
  const { user, loading: authLoading } = useUser();

  const [drills, setDrills] = useState<Drill[]>([
    { label: "10 Questions / 5 minutes", score: "—" },
    { label: "20 Questions / 10 minutes", score: "—" },
    { label: "30 Questions / 15 minutes", score: "—" },
  ]);
  const [avgTime, setAvgTime] = useState("—");
  const [fastestSubject, setFastestSubject] = useState("—");
  const [slowestSubject, setSlowestSubject] = useState("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getUserAttempts(supabase, user.id, 50).then((attempts) => {
      if (attempts.length === 0) { setLoading(false); return; }

      // Compute average seconds per question from submitted attempts that have timing
      const timed = attempts.filter((a) => a.submitted_at && a.started_at && a.question_count > 0);
      if (timed.length > 0) {
        const totalSecs = timed.reduce((s, a) => {
          const ms = new Date(a.submitted_at!).getTime() - new Date(a.started_at).getTime();
          return s + ms / 1000 / a.question_count;
        }, 0);
        const avg = Math.round(totalSecs / timed.length);
        setAvgTime(`${avg}s / Q`);
      }

      // Accuracy bands — bucket by count into our drill categories
      const small = attempts.filter((a) => a.question_count <= 12);
      const medium = attempts.filter((a) => a.question_count > 12 && a.question_count <= 22);
      const large = attempts.filter((a) => a.question_count > 22 && a.question_count <= 32);

      function avgAcc(arr: typeof attempts) {
        if (arr.length === 0) return null;
        const total = arr.reduce((s, a) => s + a.question_count, 0);
        const correct = arr.reduce((s, a) => s + a.score, 0);
        return total > 0 ? Math.round((correct / total) * 100) : null;
      }

      setDrills([
        { label: "10 Questions / 5 minutes", score: avgAcc(small) !== null ? `${avgAcc(small)}%` : "—" },
        { label: "20 Questions / 10 minutes", score: avgAcc(medium) !== null ? `${avgAcc(medium)}%` : "—" },
        { label: "30 Questions / 15 minutes", score: avgAcc(large) !== null ? `${avgAcc(large)}%` : "—" },
      ]);
    }).finally(() => setLoading(false));
  }, [user, authLoading]);

  return (
    <AppShell title="Speed Training">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <h1 className="mb-4 text-2xl font-black text-slate-900">Timed Drills</h1>
        <AuthGuard user={user} loading={authLoading}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-5">
            {loading
              ? [1, 2, 3].map((n) => <div key={n} className="animate-pulse rounded-[24px] bg-slate-100 h-20" />)
              : drills.map((item) => (
                  <div key={item.label} className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-black text-slate-900">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-500">Average accuracy for this session length</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
                        {item.score}
                      </span>
                    </div>
                  </div>
                ))}

            <Link
              href="/practice?count=10&timer=5%20minutes"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-300/20"
            >
              Start a speed drill
            </Link>
          </section>

          <aside className="rounded-[28px] bg-slate-900 p-6 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Performance</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Average time per question</p>
                <p className="mt-2 text-2xl font-black">{loading ? "…" : avgTime}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fastest subject</p>
                <p className="mt-2 text-2xl font-black">{loading ? "…" : fastestSubject}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Slowest subject</p>
                <p className="mt-2 text-2xl font-black">{loading ? "…" : slowestSubject}</p>
              </div>
            </div>
          </aside>
        </div>
        </AuthGuard>
      </div>
    </AppShell>
  );
}
