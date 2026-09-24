"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSubjectStats } from "@/lib/queries";
import type { SubjectStats } from "@/lib/queries";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Task = { subject: string; duration: string; completed: boolean };
type DayPlan = { day: string; tasks: Task[] };

/**
 * Builds a simple weekly study plan from subject stats.
 * Weaker subjects get more time. Falls back to a generic plan when no data.
 */
function buildPlan(stats: SubjectStats[]): DayPlan[] {
  const sorted = [...stats].sort((a, b) => a.accuracy - b.accuracy);

  // Assign subjects to days (cycle if fewer than 5)
  const subjects = sorted.length > 0
    ? sorted.map((s) => ({ name: s.subjectName, weak: s.accuracy < 60 }))
    : [
        { name: "Chemistry", weak: true },
        { name: "Mathematics", weak: false },
        { name: "Biology", weak: true },
        { name: "Physics", weak: false },
        { name: "English Language", weak: false },
      ];

  return DAYS.slice(0, 5).map((day, i) => {
    const primary = subjects[i % subjects.length];
    const secondary = subjects[(i + 1) % subjects.length];
    return {
      day,
      tasks: [
        { subject: primary.name, duration: primary.weak ? "45 min" : "30 min", completed: false },
        { subject: secondary.name, duration: "20 min", completed: false },
      ],
    };
  });
}

const PLAN_STORAGE_KEY = "orbit_study_plan_completed";

export default function StudyPlanPage() {
  const { user, loading: authLoading } = useUser();

  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load plan
  useEffect(() => {
    if (authLoading) return;

    // Restore completed tasks from localStorage
    try {
      const stored = localStorage.getItem(PLAN_STORAGE_KEY);
      if (stored) setCompleted(new Set(JSON.parse(stored) as string[]));
    } catch { /* ignore */ }

    if (!user) {
      setPlan(buildPlan([]));
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    getSubjectStats(supabase, user.id)
      .then((stats) => setPlan(buildPlan(stats)))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  function toggleTask(key: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const totalTasks = plan.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = plan.reduce(
    (s, d) => s + d.tasks.filter((_, ti) => completed.has(`${d.day}-${ti}`)).length,
    0,
  );
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[30px] bg-white p-6 ring-1 ring-slate-200 shadow-[0_18px_60px_rgba(93,74,228,0.1)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-500">Study Plan</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Personalized schedule</h1>
          </div>
          <Link href="/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Dashboard
          </Link>
        </div>

        {/* Weekly progress bar */}
        <div className="mb-6 rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Weekly completion</span>
            <span>{doneTasks}/{totalTasks} tasks · {pct}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          {!user && (
            <p className="mt-2 text-xs text-slate-400">
              Sign in to get a plan tailored to your weak subjects.{" "}
              <Link href="/" className="font-bold text-violet-600">Sign in</Link>
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="animate-pulse rounded-[28px] bg-slate-100 p-5 h-36" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {plan.map((day) => (
              <div key={day.day} className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="mb-4 text-2xl font-black text-slate-900">{day.day}</h2>
                <div className="space-y-3">
                  {day.tasks.map((task, ti) => {
                    const key = `${day.day}-${ti}`;
                    const done = completed.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleTask(key)}
                        className={`flex w-full items-center justify-between rounded-2xl p-3 ring-1 text-left transition ${done ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200 hover:ring-violet-200"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>
                            {done ? "✓" : ""}
                          </span>
                          <span className={`font-semibold ${done ? "text-emerald-800 line-through" : "text-slate-800"}`}>
                            {task.subject} · {task.duration}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${done ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                          {done ? "Done" : "Planned"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
