"use client";

import { useMemo, useState } from "react";
import { weekSummary, type AttemptLike } from "@/lib/trends";

/**
 * The last seven days (Lagos time): questions answered each day against the daily goal, with a summary and a
 * comparison with the week before. Tap a bar to read that day.
 */
export default function WeekChart({ attempts, goal }: { attempts: AttemptLike[]; goal: number }) {
  const week = useMemo(() => weekSummary(attempts, goal), [attempts, goal]);
  const [picked, setPicked] = useState<string | null>(null);

  const topValue = Math.max(goal, ...week.days.map((d) => d.questions)) * 1.12;
  const sel = week.days.find((d) => d.key === picked) ?? week.days[week.days.length - 1];
  const goalPct = (goal / topValue) * 100;
  const hitDays = week.days.filter((d) => d.hitGoal).length;

  const change =
    week.changePct === null
      ? week.total > 0
        ? "No practice the week before"
        : null
      : week.changePct === 0
        ? "Same as last week"
        : `${week.changePct > 0 ? "▲" : "▼"} ${Math.abs(week.changePct)}% vs last week`;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Questions", value: week.total.toLocaleString() },
          { label: "Days practised", value: `${week.daysPractised} of 7` },
          { label: "Goal reached", value: `${hitDays} ${hitDays === 1 ? "day" : "days"}` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white px-2 py-2.5 ring-1 ring-slate-200">
            <p className="text-lg font-black tabular-nums text-slate-900">{s.value}</p>
            <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
      {change && (
        <p className={`mt-2 text-xs font-bold ${week.changePct !== null && week.changePct < 0 ? "text-rose-600" : week.changePct !== null && week.changePct > 0 ? "text-emerald-600" : "text-slate-500"}`}>
          {change}
        </p>
      )}

      <div className="relative mt-3" role="group" aria-label="Questions answered each day this week">
        <div className="relative flex h-40 items-end gap-1.5">
          {/* daily goal line */}
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed" style={{ bottom: `${goalPct}%`, borderColor: "var(--chart-target)" }} aria-hidden>
            <span className={`absolute -top-4 ${week.days[0].questions <= week.days[6].questions ? "left-0" : "right-0"} rounded bg-slate-50 px-1 text-[10px] font-bold`} style={{ color: "var(--chart-target)" }}>
              Goal {goal}
            </span>
          </div>
          {week.days.map((d) => {
            const h = d.questions > 0 ? Math.max((d.questions / topValue) * 100, 5) : 3;
            const isSel = d.key === sel.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setPicked(d.key)}
                aria-pressed={isSel}
                aria-label={`${d.longLabel}${d.isToday ? " (today)" : ""}: ${d.questions} questions${d.hitGoal ? ", goal reached" : ""}`}
                className="group flex h-full min-w-0 flex-1 touch-manipulation flex-col items-center justify-end outline-none"
              >
                <span className="mb-1 text-[10px] font-black tabular-nums text-slate-500">{d.questions > 0 ? d.questions : ""}</span>
                <span
                  className={`w-full rounded-t-lg transition-[height,box-shadow] duration-500 motion-reduce:transition-none ${
                    d.questions === 0 ? "bg-slate-200" : d.hitGoal ? "bg-amber-400" : "bg-violet-400"
                  } ${isSel ? "ring-2 ring-offset-2 ring-violet-500 ring-offset-slate-50" : "group-focus-visible:ring-2 group-focus-visible:ring-violet-500"}`}
                  style={{ height: `${h}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {week.days.map((d) => (
            <span key={d.key} className={`min-w-0 flex-1 truncate text-center text-[11px] ${d.isToday ? "font-black text-amber-600" : "text-slate-500"}`}>
              {d.isToday ? "Today" : d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200" aria-live="polite">
        <p className="text-sm font-black text-slate-900">
          {sel.isToday ? "Today" : sel.longLabel}
          <span className="font-semibold text-slate-500">
            {" "}
            · {sel.questions === 0 ? "no questions" : `${sel.questions} question${sel.questions === 1 ? "" : "s"}`}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {sel.questions === 0
            ? `Goal is ${goal} a day.`
            : `${sel.accuracy}% correct${sel.hitGoal ? " · goal reached 🎯" : ` · ${goal - sel.questions} short of the goal`}`}
        </p>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" aria-hidden /> Goal reached
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-400" aria-hidden /> Some practice
        </span>
      </p>
    </div>
  );
}
