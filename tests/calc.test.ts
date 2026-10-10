import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, formatNumber, press, preview, INITIAL_STATE, type CalcKey, type CalcState } from "../src/lib/calc.ts";

const val = (expr: string, mode: "deg" | "rad" = "deg"): number | string => {
  const r = evaluate(expr, mode);
  return r.ok ? Number(formatNumber(r.value)) : r.error;
};

/** type keys one by one, like a student would */
function type(keys: string, from: CalcState = INITIAL_STATE): CalcState {
  const map: Record<string, CalcKey> = { "÷": "/", "×": "*", "−": "-", "π": "pi", "√": "sqrt", "±": "neg", "<": "back", C: "clear", s: "sin", k: "cos", t: "tan", g: "log", n: "ln", q: "sq" };
  let s = from;
  for (const ch of keys) s = press(s, (map[ch] ?? ch) as CalcKey);
  return s;
}

test("order of operations", () => {
  assert.equal(val("2+3×4"), 14);
  assert.equal(val("(2+3)×4"), 20);
  assert.equal(val("10−4−3"), 3);
  assert.equal(val("100÷5÷4"), 5);
  assert.equal(val("2+3×4^2"), 50);
});

test("minus signs work anywhere, including on a negative answer", () => {
  assert.equal(val("−5+2"), -3);
  assert.equal(val("5×−3"), -15);
  assert.equal(val("5−−3"), 8);
  assert.equal(val("2^−3"), 0.125);
  assert.equal(val("−2^2"), -4);
  assert.equal(val("(−5)^2"), 25);
});

test("decimals do not drift", () => {
  assert.equal(val("0.1+0.2"), 0.3);
  assert.equal(val("1.1×1.1"), 1.21);
  assert.equal(val("0.3−0.1"), 0.2);
  assert.equal(val("1÷3×3"), 1);
});

test("percent behaves like a handheld calculator", () => {
  assert.equal(val("50%"), 0.5);
  assert.equal(val("200×10%"), 20);
  assert.equal(val("200+10%"), 220);
  assert.equal(val("200−25%"), 150);
});

test("powers, roots and logs", () => {
  assert.equal(val("2^3^2"), 512);
  assert.equal(val("√(144)"), 12);
  assert.equal(val("√(2)^2"), 2);
  assert.equal(val("log(1000)"), 3);
  assert.equal(val("ln(e)"), 1);
  assert.equal(val("9^0.5"), 3);
});

test("implicit multiplication", () => {
  assert.equal(val("2(3+4)"), 14);
  assert.equal(val("(1+1)(2+2)"), 8);
  assert.equal(val("2π"), Number((2 * Math.PI).toPrecision(12)));
  assert.equal(val("3√(16)"), 12);
});

test("trig in degrees is exact where it should be", () => {
  assert.equal(val("sin(30)"), 0.5);
  assert.equal(val("cos(60)"), 0.5);
  assert.equal(val("tan(45)"), 1);
  assert.equal(val("sin(180)"), 0);
  assert.equal(val("cos(90)"), 0);
  assert.equal(val("sin(90)"), 1);
  assert.equal(val("cos(180)"), -1);
  assert.equal(val("sin(270)"), -1);
  assert.equal(val("sin(−90)"), -1);
  assert.equal(val("tan(90)"), "Math error");
  assert.equal(val("sin30"), 0.5);
});

test("trig in radians", () => {
  assert.equal(val("sin(π)", "rad"), 0);
  assert.equal(val("cos(π)", "rad"), -1);
  assert.equal(val("sin(π÷2)", "rad"), 1);
  assert.equal(val("tan(π÷4)", "rad"), 1);
});

test("errors say what is wrong", () => {
  assert.equal(val("5÷0"), "Can't divide by 0");
  assert.equal(val("0^−1"), "Can't divide by 0");
  assert.equal(val("√(−4)"), "Invalid input");
  assert.equal(val("log(0)"), "Invalid input");
  assert.equal(val("5+"), "Incomplete expression");
  assert.equal(val(""), "Incomplete expression");
  assert.equal(val("5)"), "Check the brackets");
  assert.equal(val("(−8)^0.5"), "Math error");
  assert.equal(val("2$3"), "Unknown symbol");
});

test("a missing closing bracket is closed for you", () => {
  assert.equal(val("(2+3"), 5);
  assert.equal(val("2×(3+4"), 14);
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
  assert.equal(type("(×5").expr, "(5");
  assert.equal(type("(−5").expr, "(−5");
});

test("typing: brackets and percent only where they make sense", () => {
  assert.equal(type(")").expr, "");
  assert.equal(type("(2+3)").expr, "(2+3)");
  assert.equal(type("(2+)").expr, "(2+");
  assert.equal(type("%").expr, "");
  assert.equal(type("50%").expr, "50%");
  assert.equal(type("^2").expr, "2");
  assert.equal(type("3^2").expr, "3^2");
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
  assert.equal(type("×4=", done).expr, "20");
  assert.equal(type("(", done).expr, "(");
});

test("a negative answer can be used in the next sum", () => {
  const s = type("2−5=");
  assert.equal(s.expr, "−3");
  assert.equal(type("+10=", s).expr, "7");
  assert.equal(type("×−2=", s).expr, "6");
});

test("a bad sum shows an error and keeps what was typed", () => {
  const s = type("5÷0=");
  assert.equal(s.error, "Can't divide by 0");
  assert.equal(s.expr, "5÷0");
  assert.equal(type("<", s).error, null);
  assert.equal(type("<", s).expr, "5÷");
});

test("equals with open brackets closes them", () => {
  assert.equal(type("2×(3+4=").expr, "14");
});

test("backspace removes a whole function name", () => {
  assert.equal(type("s30<").expr, "sin(3");
  assert.equal(type("s<").expr, "");
  assert.equal(type("2√<").expr, "2");
});

test("clear keeps the degree/radian choice", () => {
  const s = type("5+5C", press(INITIAL_STATE, "mode"));
  assert.equal(s.expr, "");
  assert.equal(s.mode, "rad");
});

test("± flips the sign of the number being typed", () => {
  assert.equal(type("±").expr, "−");
  assert.equal(type("5±").expr, "−5");
  assert.equal(type("5±±").expr, "5");
  assert.equal(type("2×3±").expr, "2×−3");
  assert.equal(type("2×3±±").expr, "2×3");
  assert.equal(type("2+3±").expr, "2+(−3)");
  assert.equal(type("2+3±±").expr, "2+3");
  assert.equal(type("2+3±=").expr, "−1");
});

test("x² and the constants", () => {
  assert.equal(type("7q=").expr, "49");
  assert.equal(type("π").expr, "π");
  assert.equal(type("2π=").expr, formatNumber(2 * Math.PI));
});

test("degrees or radians from the keypad", () => {
  assert.equal(type("s30)=").expr, "0.5");
  const rad = press(INITIAL_STATE, "mode");
  assert.equal(type("sπ)=", rad).expr, "0");
});

test("preview appears for a finished sum, not for a plain number or half a sum", () => {
  assert.equal(preview(type("2+3")), "5");
  assert.equal(preview(type("7")), null);
  assert.equal(preview(type("2+")), null);
  assert.equal(preview(type("2+3=")), null);
  assert.equal(preview(type("(2+3")), "5");
  assert.equal(preview(type("5÷0")), null);
});

test("a long run of presses never leaves the pad in a broken state", () => {
  const keys: CalcKey[] = ["1", "2", "+", "-", "*", "/", "^", "%", "(", ")", ".", "sin", "sqrt", "neg", "back", "pi", "e", "=", "sq", "ln"];
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let s = INITIAL_STATE;
  for (let i = 0; i < 4000; i++) {
    s = press(s, keys[Math.floor(rand() * keys.length)]);
    assert.ok(s.expr.length <= 85, "expression stays a sensible length");
    assert.equal(typeof s.expr, "string");
  }
});
