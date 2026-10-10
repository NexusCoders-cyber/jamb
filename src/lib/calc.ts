/**
 * The exam calculator's brain: a real expression parser plus the key-press rules.
 *
 * Pure (no React, no imports from other app files) so `npm test` can check the maths.
 *
 * What it does that the old pad did not:
 *  - proper order of operations, brackets, powers, square roots, % and a minus sign anywhere ("5×−3", "−5+2")
 *  - sin / cos / tan in degrees or radians (exact at quarter turns, so sin(180°) is 0, not 1.2e-16)
 *  - answers are rounded to 12 significant digits so 0.1 + 0.2 shows 0.3
 *  - typing a digit after "=" starts a new sum; typing an operator carries on from the answer
 *  - clear error messages instead of silently doing nothing
 */

export type AngleMode = "deg" | "rad";
export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

const ERR = {
  div0: "Can't divide by 0",
  invalid: "Invalid input",
  math: "Math error",
  incomplete: "Incomplete expression",
  brackets: "Check the brackets",
  symbol: "Unknown symbol",
} as const;

type Tok =
  | { t: "num"; v: number }
  | { t: "const"; v: number }
  | { t: "fn"; name: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" | "%" }
  | { t: "(" }
  | { t: ")" };

const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:E[+-]?\d+)?/;
const FUNCS = new Set(["sin", "cos", "tan", "log", "ln", "sqrt"]);

function tokenize(src: string): Tok[] | string {
  const s = src.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–—]/g, "-").replace(/√/g, "sqrt");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const num = NUMBER.exec(rest);
    if (num) {
      out.push({ t: "num", v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const ch = s[i];
    if ("+-*/^%".includes(ch)) { out.push({ t: "op", v: ch as "+" }); i++; continue; }
    if (ch === "(") { out.push({ t: "(" }); i++; continue; }
    if (ch === ")") { out.push({ t: ")" }); i++; continue; }
    if (ch === "π") { out.push({ t: "const", v: Math.PI }); i++; continue; }
    const word = /^[a-z]+/.exec(rest);
    if (word) {
      const w = word[0];
      if (w === "e") { out.push({ t: "const", v: Math.E }); i += 1; continue; }
      if (w === "pi") { out.push({ t: "const", v: Math.PI }); i += 2; continue; }
      if (FUNCS.has(w)) { out.push({ t: "fn", name: w }); i += w.length; continue; }
      // things like "2e3" are not supported; "esin(30)" would be e × sin(30)
      if (w.startsWith("e") && w.length > 1) { out.push({ t: "const", v: Math.E }); i += 1; continue; }
    }
    return ERR.symbol;
  }
  return out;
}

class CalcError extends Error {}
const fail = (m: string): never => { throw new CalcError(m); };

type Val = { v: number; pct: boolean };

function trig(name: "sin" | "cos" | "tan", x: number, mode: AngleMode): number {
  if (mode === "deg") {
    // exact answers at quarter turns, so sin(180) is 0 and tan(90) is an error
    const q = x / 90;
    if (Number.isInteger(q)) {
      const k = ((q % 4) + 4) % 4;
      if (name === "sin") return [0, 1, 0, -1][k];
      if (name === "cos") return [1, 0, -1, 0][k];
      if (k % 2 === 1) return fail(ERR.math);
      return 0;
    }
    x = (x * Math.PI) / 180;
  }
  if (name === "tan") {
    if (Math.abs(Math.cos(x)) < 1e-15) return fail(ERR.math);
    return Math.tan(x);
  }
  const r = name === "sin" ? Math.sin(x) : Math.cos(x);
  return Math.abs(r) < 1e-15 ? 0 : r;
}

function applyFn(name: string, x: number, mode: AngleMode): number {
  switch (name) {
    case "sin": case "cos": case "tan": return trig(name, x, mode);
    case "sqrt": return x < 0 ? fail(ERR.invalid) : Math.sqrt(x);
    case "log": return x <= 0 ? fail(ERR.invalid) : Math.log10(x);
    case "ln": return x <= 0 ? fail(ERR.invalid) : Math.log(x);
    default: return fail(ERR.symbol);
  }
}

class Parser {
  private p = 0;
  private toks: Tok[];
  private mode: AngleMode;
  constructor(toks: Tok[], mode: AngleMode) {
    this.toks = toks;
    this.mode = mode;
  }

  run(): number {
    if (this.toks.length === 0) return fail(ERR.incomplete);
    const v = this.additive();
    if (this.p < this.toks.length) return fail(this.toks[this.p].t === ")" ? ERR.brackets : ERR.incomplete);
    return v.v;
  }

  private peek(): Tok | undefined { return this.toks[this.p]; }
  private isOp(t: Tok | undefined, ...ops: string[]): boolean { return !!t && t.t === "op" && ops.includes(t.v); }

  /** a + b − c. "200 + 10%" means 200 + 10% of 200 (like a handheld calculator) */
  private additive(): Val {
    let left = this.term();
    while (this.isOp(this.peek(), "+", "-")) {
      const op = (this.toks[this.p++] as { v: string }).v;
      const right = this.term();
      const r = right.pct ? left.v * right.v : right.v;
      left = { v: op === "+" ? left.v + r : left.v - r, pct: false };
    }
    return left;
  }

  /** a × b ÷ c, and implicit multiplication: 2π, 3(4+1), (2)(3), 2sin(30) */
  private term(): Val {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (this.isOp(t, "*", "/")) {
        this.p++;
        const right = this.unary();
        if ((t as { v: string }).v === "/") {
          if (right.v === 0) return fail(ERR.div0);
          left = { v: left.v / right.v, pct: false };
        } else left = { v: left.v * right.v, pct: false };
      } else if (t && (t.t === "num" || t.t === "const" || t.t === "fn" || t.t === "(")) {
        const right = this.unary();
        left = { v: left.v * right.v, pct: false };
      } else break;
    }
    return left;
  }

  private unary(): Val {
    const t = this.peek();
    if (this.isOp(t, "-")) { this.p++; const x = this.unary(); return { v: -x.v, pct: false }; }
    if (this.isOp(t, "+")) { this.p++; return this.unary(); }
    return this.power();
  }

  /** a^b, right to left (2^3^2 = 2^9), and the exponent may be negative (2^−3) */
  private power(): Val {
    const base = this.postfix();
    if (this.isOp(this.peek(), "^")) {
      this.p++;
      const e = this.unary();
      if (base.v === 0 && e.v < 0) return fail(ERR.div0);
      const v = Math.pow(base.v, e.v);
      if (Number.isNaN(v)) return fail(ERR.math);
      return { v, pct: false };
    }
    return base;
  }

  private postfix(): Val {
    let x = this.primary();
    while (this.isOp(this.peek(), "%")) {
      this.p++;
      x = { v: x.v / 100, pct: true };
    }
    return x;
  }

  private primary(): Val {
    const t = this.peek();
    if (!t) return fail(ERR.incomplete);
    if (t.t === "num" || t.t === "const") { this.p++; return { v: t.v, pct: false }; }
    if (t.t === "(") {
      this.p++;
      const v = this.additive();
      if (this.peek()?.t === ")") this.p++; // a missing ")" at the very end is closed for you
      else if (this.p < this.toks.length) return fail(ERR.brackets);
      return { v: v.v, pct: false };
    }
    if (t.t === "fn") {
      this.p++;
      let arg: number;
      if (this.peek()?.t === "(") {
        this.p++;
        arg = this.additive().v;
        if (this.peek()?.t === ")") this.p++;
        else if (this.p < this.toks.length) return fail(ERR.brackets);
      } else {
        arg = this.unary().v; // sin30
      }
      return { v: applyFn(t.name, arg, this.mode), pct: false };
    }
    return fail(t.t === ")" ? ERR.brackets : ERR.incomplete);
  }
}

/** Work out an expression. Accepts × ÷ − π √ as well as * / - pi sqrt. */
export function evaluate(expr: string, mode: AngleMode = "deg"): CalcResult {
  const toks = tokenize(expr);
  if (typeof toks === "string") return { ok: false, error: toks };
  try {
    const v = new Parser(toks, mode).run();
    if (!Number.isFinite(v)) return { ok: false, error: ERR.math };
    return { ok: true, value: v };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message };
    return { ok: false, error: ERR.math };
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
  mode: AngleMode;
};

export const INITIAL_STATE: CalcState = { expr: "", history: "", fresh: false, error: null, mode: "deg" };

export type CalcKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "."
  | "+" | "-" | "*" | "/" | "^" | "%" | "(" | ")"
  | "sin" | "cos" | "tan" | "log" | "ln" | "sqrt" | "sq" | "pi" | "e"
  | "neg" | "back" | "clear" | "=" | "mode";

const MAX_LEN = 80;
const MAX_DIGITS = 15;
const OPS = "+−×÷^";
const NUM_TAIL = /(\d+\.?\d*(?:E[+-]?\d+)?|\.\d+|π|e)$/;
const FN_TAIL = /(sin|cos|tan|log|ln|√)\($/;
const symbolFor = (k: string): string => (k === "-" ? "−" : k === "*" ? "×" : k === "/" ? "÷" : k);
const endsWithValue = (s: string): boolean => /[\d.)%πe]$/.test(s);
const openCount = (s: string): number => (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0);

function withOperator(expr: string, op: string): string | null {
  const last = expr.slice(-1);
  if (expr === "") return op === "−" ? "−" : null;
  if (last === "(") return op === "−" ? expr + "−" : null;
  if (OPS.includes(last)) {
    // a minus after × ÷ ^ is a sign ("5×−3"); anything else replaces the operator
    if (op === "−" && "×÷^".includes(last)) return expr + "−";
    let base = expr;
    while (base && OPS.includes(base.slice(-1))) base = base.slice(0, -1);
    if (base === "" || base.endsWith("(")) return op === "−" ? base + "−" : null;
    return base + op;
  }
  return expr + op;
}

export function press(initial: CalcState, key: CalcKey): CalcState {
  let state = initial;
  if (key === "mode") return { ...state, mode: state.mode === "deg" ? "rad" : "deg", error: null };
  if (key === "clear") return { ...INITIAL_STATE, mode: state.mode };

  let { expr } = state;
  const { mode } = state;
  const next = (over: Partial<CalcState>): CalcState => ({ expr, history: state.history, fresh: false, error: null, mode, ...over });

  if (key === "=") {
    if (!expr) return state;
    const closed = expr + ")".repeat(Math.max(0, openCount(expr)));
    const res = evaluate(closed, mode);
    if (!res.ok) return { ...state, error: res.error };
    return { expr: formatNumber(res.value).replace(/^-/, "−"), history: `${closed} =`, fresh: true, error: null, mode };
  }

  if (key === "back") {
    if (!expr) return { ...state, error: null };
    const fn = FN_TAIL.exec(expr);
    expr = fn ? expr.slice(0, -fn[0].length) : expr.slice(0, -1);
    return { expr, history: "", fresh: false, error: null, mode };
  }

  const isDigitKey = /^[0-9]$/.test(key);
  const startsValue = isDigitKey || key === "." || key === "(" || key === "pi" || key === "e" || key === "sin" || key === "cos" || key === "tan" || key === "log" || key === "ln" || key === "sqrt";
  // after "=", typing a number starts a fresh sum; an operator carries on from the answer
  if (state.fresh && startsValue) { expr = ""; state = { ...state, history: "" }; }
  if (expr.length >= MAX_LEN && key !== "neg") return state;

  if (isDigitKey) {
    const tail = /(\d+\.?\d*)$/.exec(expr)?.[1] ?? "";
    if (tail.replace(".", "").length >= MAX_DIGITS) return next({});
    if (tail === "0") return next({ expr: expr.slice(0, -1) + key });
    return next({ expr: expr + key });
  }

  switch (key) {
    case ".": {
      const tail = /(\d*\.?\d*)$/.exec(expr)?.[1] ?? "";
      if (tail.includes(".")) return next({});
      return next({ expr: expr + (/\d$/.test(expr) ? "." : "0.") });
    }
    case "+": case "-": case "*": case "/": {
      const r = withOperator(expr, symbolFor(key));
      return r === null ? next({}) : next({ expr: r });
    }
    case "^": {
      if (!endsWithValue(expr)) return next({});
      return next({ expr: expr + "^" });
    }
    case "%": {
      if (!endsWithValue(expr)) return next({});
      return next({ expr: expr + "%" });
    }
    case "sq": {
      if (!endsWithValue(expr)) return next({});
      return next({ expr: expr + "^2" });
    }
    case "(": return next({ expr: expr + "(" });
    case ")": {
      if (openCount(expr) <= 0 || !endsWithValue(expr)) return next({});
      return next({ expr: expr + ")" });
    }
    case "pi": return next({ expr: expr + "π" });
    case "e": return next({ expr: expr + "e" });
    case "sin": case "cos": case "tan": case "log": case "ln": return next({ expr: `${expr}${key}(` });
    case "sqrt": return next({ expr: expr + "√(" });
    case "neg": return next({ expr: negate(expr), history: "" });
    default: return next({});
  }
}

/** The ± key: flips the sign of the number you are typing (or the last answer) */
export function negate(expr: string): string {
  if (expr === "") return "−";
  // "(−3)" → "3"
  const wrapped = /\(−([^()]+)\)$/.exec(expr);
  if (wrapped) return expr.slice(0, wrapped.index) + wrapped[1];
  const m = NUM_TAIL.exec(expr);
  if (!m) {
    const r = withOperator(expr, "−");
    return r ?? expr;
  }
  const prefix = expr.slice(0, m.index);
  const n = m[0];
  if (prefix === "") return "−" + n;
  const before = prefix.slice(-1);
  if (before === "−" && (prefix.length === 1 || "(×÷^".includes(prefix.slice(-2, -1)))) return prefix.slice(0, -1) + n;
  if ("(×÷^".includes(before)) return prefix + "−" + n;
  return `${prefix}(−${n})`;
}

/** A faint "= answer" shown while typing, only when the sum is complete and not just a plain number */
export function preview(state: CalcState): string | null {
  const { expr, mode } = state;
  if (state.fresh || !expr) return null;
  if (!/[+−×÷^%(√]|sin|cos|tan|log|ln/.test(expr.replace(/^−/, ""))) return null;
  if (!endsWithValue(expr) && !expr.endsWith(")")) return null;
  const res = evaluate(expr + ")".repeat(Math.max(0, openCount(expr))), mode);
  return res.ok ? formatNumber(res.value) : null;
}
