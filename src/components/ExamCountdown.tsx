"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, Pencil, X } from "lucide-react";

const KEY = "qubit_exam_date";
const EVENT = "qubit-exam-date";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
function write(value: string) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked — the date just won't be remembered */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Days from today (local midnight) to a yyyy-mm-dd date; negative if it has passed. */
export function daysUntil(isoDate: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const target = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Dashboard card: "N days to your UTME". The date is kept on the device — no account or network needed. */
export default function ExamCountdown() {
  const date = useSyncExternalStore(subscribe, read, () => "");
  const [editing, setEditing] = useState(false);
  const days = date ? daysUntil(date) : null;
  const showEditor = editing || days === null;

  return (
    <section className="mb-5 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-100" aria-label="Exam countdown">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        {showEditor ? (
          <div className="min-w-0 flex-1">
            <label htmlFor="exam-date" className="text-sm font-black text-slate-900">When is your UTME?</label>
            <input
              id="exam-date"
              type="date"
              defaultValue={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                write(e.target.value);
                if (e.target.value) setEditing(false);
              }}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-black leading-none text-slate-900">
              {days! > 0 ? days : days === 0 ? "Today" : "Done"}
              {days! > 0 && <span className="ml-1.5 text-sm font-bold text-slate-500">{days === 1 ? "day" : "days"} to go</span>}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {days! > 0 ? "until your UTME — keep practising daily" : days === 0 ? "Good luck — you've got this!" : "Your exam date has passed"}
            </p>
          </div>
        )}
        {!showEditor && (
          <button type="button" onClick={() => setEditing(true)} aria-label="Change exam date" className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
        )}
        {showEditor && days !== null && (
          <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
