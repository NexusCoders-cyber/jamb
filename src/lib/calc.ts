/**
 * The exam calculator's brain: a standard four-function calculator (+ − × ÷) with a decimal point.
 *
 * Pure (no React, no imports from other app files) so `npm test` can check the maths.
 *
 *  - × and ÷ are done before + and −, so 2 + 3 × 4 is 14
 *  - a minus sign works anywhere a number can start: "−5 + 2", "5 × −3", and a negative answer can be used in the next sum
 *  - answers are rounded to 12 significant digits, so 0.1 + 0.2 shows 0.3
 *  - typing a digit after "=" starts a new sum; typing an operator carries on from the answer
 *  - mistakes show a short message ("Can't divide by 0") instead of silently doing nothing
 */

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

const ERR = {
  div0: "Can't divide by 0",
  math: "Math error",
  incomplete: "Incomplete sum",
  symbol: "Unknown symbol",
} as const;

type Tok = { t: "num"; v: number } | { t: "op"; v: "+" | "-" | "*" | "/" };

const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/;

function tokenize(src: string): Tok[] | string {
  const s = src.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–—]/g, "-");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const num = NUMBER.exec(s.slice(i));
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const ch = s[i];
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      out.push({ t: "op", v: ch });
      i++;
      continue;
    }
    return ERR.symbol;
  }
  return out;
}

class CalcError extends Error {}
const fail = (m: string): never => {
  throw new CalcError(m);
};

class Parser {
  private p = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  run(): number {
    if (this.toks.length === 0) return fail(ERR.incomplete);
    const v = this.additive();
    if (this.p < this.toks.length) return fail(ERR.incomplete);
    return v;
  }

  private nextOp(...ops: string[]): string | null {
    const t = this.toks[this.p];
    return t && t.t === "op" && ops.includes(t.v) ? t.v : null;
  }

  private additive(): number {
    let left = this.term();
    for (let op = this.nextOp("+", "-"); op; op = this.nextOp("+", "-")) {
      this.p++;
      const right = this.term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.unary();
    for (let op = this.nextOp("*", "/"); op; op = this.nextOp("*", "/")) {
      this.p++;
      const right = this.unary();
      if (op === "/") {
        if (right === 0) return fail(ERR.div0);
        left /= right;
      } else left *= right;
    }
    return left;
  }

  private unary(): number {
    if (this.nextOp("-")) { this.p++; return -this.unary(); }
    if (this.nextOp("+")) { this.p++; return this.unary(); }
    const t = this.toks[this.p];
    if (!t || t.t !== "num") return fail(ERR.incomplete);
    this.p++;
    return t.v;
  }
}

/** Work out a sum. Accepts × ÷ − as well as * / - */
export function evaluate(expr: string): CalcResult {
  const toks = tokenize(expr);
  if (typeof toks === "string") return { ok: false, error: toks };
  try {
    const v = new Parser(toks).run();
    if (!Number.isFinite(v)) return { ok: false, error: ERR.math };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: e instanceof CalcError ? e.message : ERR.math };
  }
}

/** The number as shown on the screen: 12 significant digits, tidy zeros, "E" notation for very big or tiny values */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  let r = Number(n.toPrecision(12));
  if (Object.is(r, -0)) r = 0;
  const abs = Math.abs(r);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return r.toExponential().replace("e", "E");
  return String(r);
}

// ─── key presses ────────────────────────────────────────────────────────────────

export type CalcState = {
  expr: string;
  /** the sum that produced the answer on screen, e.g. "2+3 =" */
  history: string;
  /** true right after "=": a digit starts a new sum, an operator carries on from the answer */
  fresh: boolean;
  error: string | null;
};

export const INITIAL_STATE: CalcState = { expr: "", history: "", fresh: false, error: null };

export type CalcKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "."
  | "+" | "-" | "*" | "/"
  | "back" | "clear" | "=";

const MAX_LEN = 60;
const MAX_DIGITS = 15;
const OPS = "+−×÷";
const symbolFor = (k: string): string => (k === "-" ? "−" : k === "*" ? "×" : k === "/" ? "÷" : k);

/** Add an operator to the sum, replacing a clumsy one: "5+" then "×" gives "5×"; "5×" then "−" is a minus sign */
function withOperator(expr: string, op: string): string | null {
  if (expr === "") return op === "−" ? "−" : null;
  const last = expr.slice(-1);
  if (!OPS.includes(last)) return expr + op;
  if (op === "−" && "×÷".includes(last)) return expr + "−";
  let base = expr;
  while (base && OPS.includes(base.slice(-1))) base = base.slice(0, -1);
  if (base === "") return op === "−" ? "−" : null;
  return base + op;
}

export function press(state: CalcState, key: CalcKey): CalcState {
  if (key === "clear") return INITIAL_STATE;

  if (key === "=") {
    if (!state.expr) return state;
    const res = evaluate(state.expr);
    if (!res.ok) return { ...state, error: res.error };
    return { expr: formatNumber(res.value).replace(/^-/, "−"), history: `${state.expr} =`, fresh: true, error: null };
  }

  if (key === "back") {
    if (!state.expr) return { ...state, error: null };
    return { expr: state.expr.slice(0, -1), history: "", fresh: false, error: null };
  }

  const startsNumber = /^[0-9.]$/.test(key);
  // after "=", typing a number starts a fresh sum; an operator carries on from the answer
  const base: CalcState = state.fresh && startsNumber ? { ...INITIAL_STATE } : state;
  const { expr } = base;
  const go = (next: string): CalcState => ({ expr: next, history: base.history, fresh: false, error: null });
  if (expr.length >= MAX_LEN) return base;

  if (/^[0-9]$/.test(key)) {
    const tail = /(\d+\.?\d*)$/.exec(expr)?.[1] ?? "";
    if (tail.replace(".", "").length >= MAX_DIGITS) return go(expr);
    if (tail === "0") return go(expr.slice(0, -1) + key); // no "007"
    return go(expr + key);
  }

  if (key === ".") {
    const tail = /(\d*\.?\d*)$/.exec(expr)?.[1] ?? "";
    if (tail.includes(".")) return go(expr);
    return go(expr + (/\d$/.test(expr) ? "." : "0."));
  }

  const next = withOperator(expr, symbolFor(key));
  return go(next ?? expr);
}
