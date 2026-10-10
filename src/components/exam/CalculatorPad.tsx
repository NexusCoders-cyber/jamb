"use client";

import { useRef, useState } from "react";
import { INITIAL_STATE, press, type CalcKey, type CalcState } from "@/lib/calc";

type KeyDef = { key: CalcKey; label: string; aria: string; tone?: "op" | "eq" };

/** Same layout the exam has always had: digits, the four operators, a point and equals */
const KEYS: KeyDef[] = [
  { key: "7", label: "7", aria: "7" },
  { key: "8", label: "8", aria: "8" },
  { key: "9", label: "9", aria: "9" },
  { key: "/", label: "÷", aria: "divide", tone: "op" },
  { key: "4", label: "4", aria: "4" },
  { key: "5", label: "5", aria: "5" },
  { key: "6", label: "6", aria: "6" },
  { key: "*", label: "×", aria: "multiply", tone: "op" },
  { key: "1", label: "1", aria: "1" },
  { key: "2", label: "2", aria: "2" },
  { key: "3", label: "3", aria: "3" },
  { key: "-", label: "−", aria: "minus", tone: "op" },
  { key: "0", label: "0", aria: "0" },
  { key: ".", label: ".", aria: "decimal point" },
  { key: "=", label: "=", aria: "equals", tone: "eq" },
  { key: "+", label: "+", aria: "plus", tone: "op" },
];

const TONE = {
  num: "bg-white/10 active:bg-white/20",
  op: "bg-white/20 active:bg-white/30",
  eq: "bg-emerald-500 text-white active:bg-emerald-400",
} as const;

/** Keyboard → calculator key, for laptops and tablets with a keyboard */
const KEYBOARD: Record<string, CalcKey> = {
  "+": "+", "-": "-", "*": "*", x: "*", X: "*", "/": "/", ".": ".", ",": ".",
  Enter: "=", "=": "=", Backspace: "back", Delete: "clear", Escape: "clear",
};

/**
 * The exam calculator: a standard + − × ÷ calculator. All the maths lives in `@/lib/calc` (tested);
 * this is only the keypad and screen.
 */
export default function CalculatorPad({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CalcState>(INITIAL_STATE);
  // true while the student is typing on a keyboard (so Enter means "="), false once they tap or Tab around
  const typing = useRef(false);
  const hit = (k: CalcKey) => setState((s) => press(s, k));
  const long = state.expr.length > 14;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Tab") { typing.current = false; return; }
    const k: CalcKey | undefined = /^[0-9]$/.test(e.key) ? (e.key as CalcKey) : KEYBOARD[e.key];
    if (!k) return;
    // Enter on a focused button presses that button, unless the student has been typing numbers
    if (e.key === "Enter" && !typing.current && (e.target as HTMLElement).tagName === "BUTTON") return;
    if (e.key !== "Enter") typing.current = true;
    e.preventDefault();
    hit(k);
  }

  return (
    <div
      role="group"
      aria-label="Calculator"
      onKeyDown={onKeyDown}
      onPointerDown={() => { typing.current = false; }}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-[24px] bg-slate-900 p-3 text-white shadow-2xl shadow-slate-900/40 sm:w-72 sm:rounded-[28px] sm:p-4 lg:bottom-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Calculator</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" aria-label="Close calculator">Hide</button>
      </div>

      <div className="mb-3 rounded-xl bg-white/10 px-3 py-2 text-right" role="status" aria-live="polite">
        <p className={`min-h-[1rem] truncate font-mono text-[11px] ${state.error ? "font-bold text-rose-300" : "text-white/50"}`}>
          {state.error ?? (state.history || " ")}
        </p>
        <p className={`min-h-[2rem] break-all font-mono font-bold leading-tight ${long ? "text-base" : "text-xl"}`}>{state.expr || "0"}</p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => hit(d.key)}
            aria-label={d.aria}
            className={`h-9 touch-manipulation select-none rounded-xl text-base font-bold transition-colors sm:h-11 ${TONE[d.tone ?? "num"]}`}
          >
            {d.label}
          </button>
        ))}
        <button type="button" onClick={() => hit("back")} className="col-span-2 h-9 touch-manipulation rounded-xl bg-white/10 text-sm font-bold active:bg-white/20 sm:h-11">Backspace</button>
        <button type="button" onClick={() => hit("clear")} className="col-span-2 h-9 touch-manipulation rounded-xl bg-rose-500/80 text-sm font-bold active:bg-rose-400 sm:h-11">Clear</button>
      </div>
    </div>
  );
}
