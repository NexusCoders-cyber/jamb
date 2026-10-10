import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, formatNumber, press, INITIAL_STATE, type CalcKey, type CalcState } from "../src/lib/calc.ts";

const val = (expr: string): number | string => {
  const r = evaluate(expr);
  return r.ok ? Number(formatNumber(r.value)) : r.error;
};

/** type keys one by one, like a student would */
function type(keys: string, from: CalcState = INITIAL_STATE): CalcState {
  const map: Record<string, CalcKey> = { "÷": "/", "×": "*", "−": "-", "<": "back", C: "clear" };
  let s = from;
  for (const ch of keys) s = press(s, (map[ch] ?? ch) as CalcKey);
  return s;
}

test("order of operations", () => {
  assert.equal(val("2+3×4"), 14);
  assert.equal(val("10−4−3"), 3);
  assert.equal(val("100÷5÷4"), 5);
  assert.equal(val("2×3+4×5"), 26);
  assert.equal(val("12÷4×3"), 9);
});

test("minus signs work anywhere, including on a negative answer", () => {
  assert.equal(val("−5+2"), -3);
  assert.equal(val("5×−3"), -15);
  assert.equal(val("5−−3"), 8);
  assert.equal(val("−5×−5"), 25);
  assert.equal(val("10÷−4"), -2.5);
});

test("decimals do not drift", () => {
  assert.equal(val("0.1+0.2"), 0.3);
  assert.equal(val("1.1×1.1"), 1.21);
  assert.equal(val("0.3−0.1"), 0.2);
  assert.equal(val("1÷3×3"), 1);
  assert.equal(val("2.5×4"), 10);
  assert.equal(val(".5+.5"), 1);
});

test("errors say what is wrong", () => {
  assert.equal(val("5÷0"), "Can't divide by 0");
  assert.equal(val("5+"), "Incomplete sum");
  assert.equal(val("×5"), "Incomplete sum");
  assert.equal(val(""), "Incomplete sum");
  assert.equal(val("2$3"), "Unknown symbol");
  assert.equal(val("(2+3)"), "Unknown symbol"); // brackets are not on this calculator
});

test("big and tiny answers are shown in a form the pad can read back", () => {
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(1 / 3), "0.333333333333");
  assert.equal(formatNumber(-0), "0");
  assert.equal(formatNumber(1e15), "1E+15");
  assert.equal(formatNumber(2.5e-9), "2.5E-9");
  assert.equal(formatNumber(123456789), "123456789");
  assert.equal(val("1E+15+1E+15"), 2e15);
  assert.equal(val("2E-9×2"), 4e-9);
});

test("typing: digits, decimals and leading zeros", () => {
  assert.equal(type("007").expr, "7");
  assert.equal(type("0.5").expr, "0.5");
  assert.equal(type(".5").expr, "0.5");
  assert.equal(type("1.2.3").expr, "1.23");
  assert.equal(type("5+.").expr, "5+0.");
  assert.equal(type("1234567890123456789").expr.length, 15);
});

test("typing: operators replace each other and a minus after × ÷ is a sign", () => {
  assert.equal(type("5+×3").expr, "5×3");
  assert.equal(type("5×−3").expr, "5×−3");
  assert.equal(type("5×−+3").expr, "5+3");
  assert.equal(type("×5").expr, "5");
  assert.equal(type("−5").expr, "−5");
  assert.equal(type("+5").expr, "5");
});

test("equals shows the answer and keeps the sum above it", () => {
  const s = type("2+3=");
  assert.equal(s.expr, "5");
  assert.equal(s.history, "2+3 =");
  assert.equal(s.fresh, true);
});

test("after equals, a digit starts a new sum but an operator carries on", () => {
  const done = type("2+3=");
  assert.equal(type("7", done).expr, "7");
  assert.equal(type("7", done).history, "");
  assert.equal(type(".", done).expr, "0.");
  assert.equal(type("×4=", done).expr, "20");
});

test("a negative answer can be used in the next sum", () => {
  const s = type("2−5=");
  assert.equal(s.expr, "−3");
  assert.equal(type("+10=", s).expr, "7");
  assert.equal(type("×−2=", s).expr, "6");
  assert.equal(type("−4=", s).expr, "−7");
});

test("a bad sum shows an error and keeps what was typed", () => {
  const s = type("5÷0=");
  assert.equal(s.error, "Can't divide by 0");
  assert.equal(s.expr, "5÷0");
  assert.equal(type("<", s).error, null);
  assert.equal(type("<", s).expr, "5÷");
  assert.equal(type("5+=").error, "Incomplete sum");
});

test("equals on an empty screen does nothing", () => {
  assert.deepEqual(type("="), INITIAL_STATE);
});

test("clear and backspace", () => {
  assert.deepEqual(type("5+5C"), INITIAL_STATE);
  assert.equal(type("123<<").expr, "1");
  assert.equal(type("<").expr, "");
});

test("a long run of presses never leaves the pad in a broken state", () => {
  const keys: CalcKey[] = ["1", "2", "0", "+", "-", "*", "/", ".", "back", "=", "clear", "9"];
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let s = INITIAL_STATE;
  for (let i = 0; i < 4000; i++) {
    s = press(s, keys[Math.floor(rand() * keys.length)]);
    assert.ok(s.expr.length <= 62, "expression stays a sensible length");
    assert.equal(typeof s.expr, "string");
  }
});
