"use client";

import { useRef, useState } from "react";
import { INITIAL_STATE, press, preview, type CalcKey, type CalcState } from "@/lib/calc";

type KeyDef = { key: CalcKey; label: string; aria: string; tone?: "op" | "fn" | "eq" | "clear" };

const SCI_KEYS: KeyDef[] = [
  { key: "sin", label: "sin", aria: "sine", tone: "fn" },
  { key: "cos", label: "cos", aria: "cosine", tone: "fn" },
  { key: "tan", label: "tan", aria: "tangent", tone: "fn" },
  { key: "log", label: "log", aria: "log base 10", tone: "fn" },
  { key: "ln", label: "ln", aria: "natural log", tone: "fn" },
  { key: "sqrt", label: "√", aria: "square root", tone: "fn" },
  { key: "sq", label: "x²", aria: "squared", tone: "fn" },
  { key: "^", label: "xʸ", aria: "to the power of", tone: "fn" },
  { key: "pi", label: "π", aria: "pi", tone: "fn" },
  { key: "e", label: "e", aria: "Euler's number", tone: "fn" },
];

const MAIN_KEYS: KeyDef[] = [
  { key: "clear", label: "C", aria: "clear", tone: "clear" },
  { key: "(", label: "(", aria: "open bracket", tone: "fn" },
  { key: ")", label: ")", aria: "close bracket", tone: "fn" },
  { key: "back", label: "⌫", aria: "backspace", tone: "fn" },
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
  { key: "neg", label: "±", aria: "change sign", tone: "fn" },
  { key: "0", label: "0", aria: "0" },
  { key: ".", label: ".", aria: "decimal point" },
  { key: "+", label: "+", aria: "plus", tone: "op" },
  { key: "%", label: "%", aria: "percent", tone: "fn" },
  { key: "=", label: "=", aria: "equals", tone: "eq" },
];

const TONE: Record<NonNullable<KeyDef["tone"]> | "num", string> = {
  num: "bg-white/10 active:bg-white/25",
  fn: "bg-white/[0.06] text-violet-200 active:bg-white/20",
  op: "bg-violet-500/35 text-white active:bg-violet-500/60",
  eq: "bg-emerald-500 text-white active:bg-emerald-400",
  clear: "bg-rose-500/80 text-white active:bg-rose-400",
};

/** Keyboard → calculator key, for laptops and tablets with a keyboard */
const KEYBOARD: Record<string, CalcKey> = {
  "+": "+", "-": "-", "*": "*", x: "*", X: "*", "/": "/", "^": "^", "%": "%", "(": "(", ")": ")", ".": ".", ",": ".",
  Enter: "=", "=": "=", Backspace: "back", Delete: "clear", Escape: "clear",
};

/**
 * The exam calculator. All the maths lives in `@/lib/calc` (tested); this is only the keypad and screen.
 * Basic keys (with brackets, % and ±) are always there; "Sci" adds sin/cos/tan, log, ln, √, x², xʸ, π and e.
 */
export default function CalculatorPad({ onClose, defaultSci = false }: { onClose: () => void; defaultSci?: boolean }) {
  const [state, setState] = useState<CalcState>(INITIAL_STATE);
  const [sci, setSci] = useState(defaultSci);
  // true while the student is typing on a keyboard (so Enter means "="), false once they tap or Tab around
  const typing = useRef(false);
  const hit = (k: CalcKey) => setState((s) => press(s, k));
  const live = preview(state);
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

  const wide = (k: CalcKey) => (k === "=" ? "col-span-3" : "");
  const renderKey = (d: KeyDef, extra = wide(d.key)) => (
    <button
      key={d.key}
      type="button"
      onClick={() => hit(d.key)}
      aria-label={d.aria}
      className={`h-9 touch-manipulation select-none rounded-xl text-base font-bold transition-colors sm:h-11 ${TONE[d.tone ?? "num"]} ${d.tone === "fn" && d.label.length > 1 ? "text-sm" : ""} ${extra}`}
    >
      {d.label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Calculator"
      onKeyDown={onKeyDown}
      onPointerDown={() => { typing.current = false; }}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-50 max-h-[calc(100dvh-7rem)] w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-[24px] bg-slate-900 p-3 text-white shadow-2xl shadow-slate-900/40 sm:w-72 sm:rounded-[28px] sm:p-4 lg:bottom-6"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSci((v) => !v)}
            aria-pressed={sci}
            aria-label="Scientific keys"
            className={`rounded-full px-3 py-1 text-xs font-bold ${sci ? "bg-violet-500 text-white" : "bg-white/10 text-white/80"}`}
          >
            Sci
          </button>
          {sci && (
            <button
              type="button"
              onClick={() => hit("mode")}
              aria-label={`Angles in ${state.mode === "deg" ? "degrees" : "radians"}. Tap to switch.`}
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-amber-200"
            >
              {state.mode}
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" aria-label="Close calculator">Hide</button>
      </div>

      <div className="mb-2.5 rounded-xl bg-white/10 px-3 py-2 text-right" role="status" aria-live="polite">
        <p className={`min-h-[1rem] truncate font-mono text-[11px] ${state.error ? "font-bold text-rose-300" : "text-white/50"}`}>
          {state.error ?? (state.history || (live ? `= ${live}` : " "))}
        </p>
        <p className={`min-h-[2rem] break-all font-mono font-bold leading-tight ${long ? "text-base" : "text-xl"}`}>{state.expr || "0"}</p>
      </div>

      {sci && <div className="mb-1.5 grid grid-cols-4 gap-1.5">{SCI_KEYS.map((d) => renderKey(d, d.key === "pi" || d.key === "e" ? "col-span-2" : ""))}</div>}
      <div className="grid grid-cols-4 gap-1.5">{MAIN_KEYS.map((d) => renderKey(d))}</div>
    </div>
  );
}
