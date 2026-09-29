"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Check, Flame, Play } from "lucide-react";
import { getSubjectStats } from "@/lib/queries";
import AppShell from "@/components/AppShell";
import type { SubjectStats } from "@/lib/queries";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Task = { subject: string; duration: string; weak: boolean; accuracy: number };
type DayPlan = { day: string; tasks: Task[] };

/**
 * Builds a weekly study plan from subject stats.
 * Weaker subjects get longer sessions and appear first.
 */
function buildPlan(stats: SubjectStats[]): DayPlan[] {
  const sorted = [...stats].sort((a, b) => a.accuracy - b.accuracy);

  const subjects = sorted.length > 0
    ? sorted.map((s) => ({ name: s.subjectName, weak: s.accuracy < 60, accuracy: s.accuracy }))
    : [
        { name: "Chemistry", weak: true, accuracy: -1 },
        { name: "Mathematics", weak: false, accuracy: -1 },
        { name: "Biology", weak: true, accuracy: -1 },
        { name: "Physics", weak: false, accuracy: -1 },
        { name: "English Language", weak: false, accuracy: -1 },
      ];

  return DAYS.slice(0, 5).map((day, i) => {
    const primary = subjects[i % subjects.length];
    const secondary = subjects[(i + 1) % subjects.length];
    return {
      day,
      tasks: [
        { subject: primary.name, duration: primary.weak ? "45 min" : "30 min", weak: primary.weak, accuracy: primary.accuracy },
        { subject: secondary.name, duration: "20 min", weak: secondary.weak, accuracy: secondary.accuracy },
      ],
    };
  });
}

const PLAN_STORAGE_KEY = "orbit_study_plan_completed_v2";
const PLAN_WEEK_KEY = "orbit_study_plan_week";

/** Monday-based week key like 2026-W40, so progress resets each Monday. */
function currentWeekKey(): string {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function StudyPlanPage() {
  const { user, loading: authLoading } = useUser();

  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load plan
  useEffect(() => {
    if (authLoading) return;

    // Restore completed tasks — reset automatically at the start of each week
    try {
      const week = localStorage.getItem(PLAN_WEEK_KEY);
      const stored = localStorage.getItem(PLAN_STORAGE_KEY);
      if (week === currentWeekKey() && stored) {
        setCompleted(new Set(JSON.parse(stored) as string[]));
      } else {
        localStorage.setItem(PLAN_WEEK_KEY, currentWeekKey());
        localStorage.removeItem(PLAN_STORAGE_KEY);
      }
    } catch (_e) { /* ignore */ }

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
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify([...next])); } catch (_e) { /* ignore */ }
      return next;
    });
  }

  // Highlight today's card
  const todayName = new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Lagos" });

  const totalTasks = plan.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = plan.reduce(
    (s, d) => s + d.tasks.filter((_, ti) => completed.has(`${d.day}-${ti}`)).length,
    0,
  );
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <AppShell title="Study Plan">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Study Plan</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">
            Week of {currentWeekKey().split("-W")[1]}
          </span>
        </div>

        {/* Weekly progress bar */}
        <div className="mb-5 rounded-[20px] bg-white p-4 ring-1 ring-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Weekly completion</span>
            <span className="text-violet-600">{doneTasks}/{totalTasks} · {pct}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400">Progress resets every Monday so each week starts fresh.</p>
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="animate-pulse rounded-[28px] bg-slate-100 p-5 h-36" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {plan.map((day) => {
              const isToday = day.day === todayName;
              return (
                <div key={day.day} className={`rounded-[28px] p-5 ring-1 ${isToday ? "bg-violet-50 ring-violet-300" : "bg-slate-50 ring-slate-200"}`}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-slate-900">{day.day}</h2>
                    {isToday && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                        Today
                      </span>
                    )}
                  </div>
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
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>
                              {done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                            </span>
                            <span>
                              <span className={`block font-semibold ${done ? "text-emerald-800 line-through" : "text-slate-800"}`}>
                                {task.subject} · {task.duration}
                              </span>
                              <span className="block text-[11px] font-semibold text-slate-400">
                                {task.accuracy >= 0
                                  ? `${task.accuracy}% accuracy${task.weak ? " — needs work" : ""}`
                                  : task.weak ? "Focus subject" : "Maintain"}
                              </span>
                            </span>
                          </div>
                          <span className="flex items-center gap-2">
                            <Link
                              href={`/practice/past-questions?subject=${encodeURIComponent(task.subject)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-violet-100 px-3 text-[11px] font-bold text-violet-700 hover:bg-violet-200"
                              aria-label={`Practise ${task.subject}`}
                            >
                              <Play className="h-3 w-3" aria-hidden /> Practise
                            </Link>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${done ? "bg-emerald-100 text-emerald-700" : task.weak ? "bg-rose-100 text-rose-700" : "bg-violet-100 text-violet-700"}`}>
                              {done ? "Done" : task.weak ? "Weak" : "Planned"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Streak nudge */}
        <div className="mt-5 flex items-center gap-3 rounded-[20px] bg-amber-50 p-4 ring-1 ring-amber-100">
          <Flame className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <p className="text-sm font-semibold text-amber-900">
            Finish a session today to keep your daily streak alive — check progress on the Streaks page.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
