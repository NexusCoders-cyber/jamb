"use client";

import { useState } from "react";
import { Timer, TimerOff } from "lucide-react";
import {
  TIMER_MAX,
  TIMER_MIN,
  TIMER_PRESETS,
  timerMinutes,
  type TimerChoice,
} from "@/lib/timer";

type Props = {
  value: TimerChoice;
  onChange: (next: TimerChoice) => void;
  /** Questions in the session, used to show what "recommended" means. */
  totalQuestions: number;
  isExam: boolean;
};

const chip = (active: boolean) =>
  `rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
    active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-violet-300"
  }`;

/** "Set a timer or don't" — one control used by every session setup. */
export default function TimerPicker({ value, onChange, totalQuestions, isExam }: Props) {
  const isPreset = value !== "none" && value !== "auto" && (TIMER_PRESETS as readonly number[]).includes(Number(value));
  const isCustomValue = value !== "none" && value !== "auto" && !isPreset;
  const [customOpen, setCustomOpen] = useState(isCustomValue);
  const [customText, setCustomText] = useState(isCustomValue ? value : "");
  const recommended = timerMinutes("auto", totalQuestions, isExam);

  function applyCustom(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 3);
    setCustomText(digits);
    const n = Number(digits);
    if (digits && n >= TIMER_MIN && n <= TIMER_MAX) onChange(String(n));
  }

  const customInvalid = customOpen && customText !== "" && !(Number(customText) >= TIMER_MIN && Number(customText) <= TIMER_MAX);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          {value === "none" ? <TimerOff className="h-3.5 w-3.5" aria-hidden /> : <Timer className="h-3.5 w-3.5" aria-hidden />}
          Timer
        </span>
        <span className="text-[11px] font-semibold text-slate-400">
          {value === "none" ? "Take as long as you like" : "Submits automatically when time is up"}
        </span>
      </div>

      <div role="radiogroup" aria-label="Timer" className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={value === "none"} className={chip(value === "none")}
          onClick={() => { setCustomOpen(false); onChange("none"); }}>
          No timer
        </button>
        <button type="button" role="radio" aria-checked={value === "auto"} className={chip(value === "auto")}
          onClick={() => { setCustomOpen(false); onChange("auto"); }}>
          Recommended{recommended ? ` · ${recommended} min` : ""}
        </button>
        {TIMER_PRESETS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={value === String(m)} className={chip(value === String(m) && !customOpen)}
            onClick={() => { setCustomOpen(false); onChange(String(m)); }}>
            {m} min
          </button>
        ))}
        <button type="button" role="radio" aria-checked={customOpen} className={chip(customOpen)}
          onClick={() => {
            setCustomOpen(true);
            // Never leave "Custom" selected while the session would actually run untimed or on another length:
            // seed the box with the time currently in force (or 30) and apply it.
            const seed = customText || String(timerMinutes(value, totalQuestions, isExam) ?? 30);
            setCustomText(seed);
            onChange(seed);
          }}>
          Custom
        </button>
      </div>

      {customOpen && (
        <div className="mt-3 flex items-center gap-2">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={customText}
            onChange={(e) => applyCustom(e.target.value)}
            placeholder="e.g. 25"
            aria-label="Custom time in minutes"
            aria-invalid={customInvalid}
            className={`h-11 w-24 rounded-xl border bg-white px-3 text-center text-sm font-bold text-slate-800 outline-none focus:border-violet-500 ${customInvalid ? "border-rose-300" : "border-slate-200"}`}
          />
          <span className="text-sm font-semibold text-slate-500">minutes</span>
          {customInvalid && <span className="text-xs font-semibold text-rose-600">Enter {TIMER_MIN}–{TIMER_MAX}</span>}
        </div>
      )}
    </div>
  );
}
