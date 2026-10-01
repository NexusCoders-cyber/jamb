/**
 * Explanation formatting for calculation subjects (Physics, Chemistry, Mathematics…).
 *
 * ALOC solutions arrive as one HTML blob. The old cleaner collapsed every line break
 * and dropped <sup>/<sub>/&times; so steps ran together:
 *     "v2 = u2 + 2as  v2 = 0 + 2 x 10 x 5  v = 10m/s"
 * This module turns that into separate, readable steps with real symbols:
 *     "v² = u² + 2as"
 *     "v² = 0 + 2 × 10 × 5"
 *     "v = 10 m/s"
 *
 * IMPORTANT: no regex lookbehind anywhere in this file. It is bundled for the browser and
 * iPhones older than iOS 16.4 refuse to parse a script that contains one.
 */

// ─── Entities ────────────────────────────────────────────────────────────────
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  times: "×", divide: "÷", minus: "−", plusmn: "±", mnplus: "∓", deg: "°",
  sup1: "¹", sup2: "²", sup3: "³", frac12: "½", frac14: "¼", frac34: "¾",
  radic: "√", pi: "π", Pi: "Π", infin: "∞", middot: "·", sdot: "⋅", bull: "•", hellip: "…",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  Delta: "Δ", delta: "δ", theta: "θ", Theta: "Θ", alpha: "α", beta: "β", gamma: "γ", Gamma: "Γ",
  lambda: "λ", Lambda: "Λ", mu: "μ", micro: "µ", omega: "ω", Omega: "Ω", rho: "ρ", sigma: "σ", Sigma: "Σ",
  phi: "φ", Phi: "Φ", epsilon: "ε", eta: "η", tau: "τ", kappa: "κ", nu: "ν", psi: "ψ", chi: "χ",
  rarr: "→", larr: "←", harr: "↔", rArr: "⇒", lArr: "⇐", hArr: "⇔", uarr: "↑", darr: "↓",
  ne: "≠", le: "≤", ge: "≥", asymp: "≈", approx: "≈", equiv: "≡", prop: "∝", there4: "∴", because: "∵",
  int: "∫", sum: "∑", part: "∂", nabla: "∇", deg_c: "°", permil: "‰", prime: "′", Prime: "″",
  euro: "€", pound: "£", cent: "¢", yen: "¥", copy: "©", reg: "®", trade: "™", para: "¶", sect: "§",
  laquo: "«", raquo: "»", lowast: "∗", ang: "∠", perp: "⊥", cap: "∩", cup: "∪", isin: "∈", sub: "⊂", sup: "⊃",
  frac13: "⅓", frac23: "⅔", frac15: "⅕", frac18: "⅛", ensp: " ", emsp: " ", thinsp: " ", zwnj: "", zwj: "",
};

/** Decode HTML entities (named + numeric). Unknown named entities are dropped, as before. */
export function decodeEntities(input: string): string {
  let s = input;
  // two passes so double-encoded text ("&amp;times;") still resolves
  for (let pass = 0; pass < 2; pass++) {
    const next = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (_m, body: string) => {
      if (body.charAt(0) === "#") {
        const hex = body.charAt(1).toLowerCase() === "x";
        const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
        if (!isFinite(code) || code <= 0 || code > 0x10ffff) return "";
        try {
          return String.fromCodePoint(code);
        } catch {
          return "";
        }
      }
      const hit = NAMED_ENTITIES[body];
      if (hit !== undefined) return hit;
      const lower = NAMED_ENTITIES[body.toLowerCase()];
      return lower !== undefined ? lower : "";
    });
    if (next === s) break;
    s = next;
  }
  return s;
}

// ─── Superscripts / subscripts ───────────────────────────────────────────────
const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ",
  n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ",
  t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

function mapChars(s: string, map: Record<string, string>): string | null {
  let out = "";
  for (const ch of s) {
    const hit = map[ch];
    if (hit === undefined) return null;
    out += hit;
  }
  return out;
}
/** "2" → "²", "-3" → "⁻³", "n+1" → "ⁿ⁺¹". Returns null when a character has no superscript form. */
export function toSuperscript(s: string): string | null {
  const t = s.replace(/\s+/g, "").replace(/[−–]/g, "-");
  return t ? mapChars(t, SUP) : null;
}
export function toSubscript(s: string): string | null {
  const t = s.replace(/\s+/g, "").replace(/[−–]/g, "-");
  return t ? mapChars(t, SUB) : null;
}
const sup = (s: string): string => toSuperscript(s) ?? (s.length === 1 ? `^${s}` : `^(${s})`);
const sub = (s: string): string => toSubscript(s) ?? (s.length === 1 ? `_${s}` : `_(${s})`);

/** <sup>2</sup> → ², <sub>2</sub> → ₂ (before any other tag is stripped) */
export function convertSupSub(input: string): string {
  return input
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_m, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]*>/g, "")).trim();
      return t ? sup(t) : "";
    })
    .replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_m, inner: string) => {
      const t = decodeEntities(inner.replace(/<[^>]*>/g, "")).trim();
      return t ? sub(t) : "";
    });
}

// ─── HTML → text that keeps its line structure ──────────────────────────────
function tidyLines(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * ALOC solution HTML → plain text where <br>, </p>, </div>, <li>, table rows become line breaks,
 * <sup>/<sub> become real superscript/subscript characters and entities (&times; &divide; &deg; …)
 * are decoded instead of being thrown away.
 */
export function htmlToExplanationText(html: string): string {
  const s = convertSupSub(html.replace(/\r\n?/g, "\n"))
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<\/\s*(?:div|tr|h[1-6]|ul|ol|table|blockquote|pre|li)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<\/\s*t[dh]\s*>/gi, "  ")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "");
  return tidyLines(decodeEntities(s));
}

// ─── LaTeX (some solutions are typed as LaTeX) ──────────────────────────────
const LATEX_SYMBOLS: Record<string, string> = {
  times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", rightarrow: "→", to: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒",
  Leftrightarrow: "⇔", rightleftharpoons: "⇌", infty: "∞", pi: "π", theta: "θ", Theta: "Θ", alpha: "α", beta: "β",
  gamma: "γ", delta: "δ", Delta: "Δ", lambda: "λ", mu: "μ", omega: "ω", Omega: "Ω", rho: "ρ", sigma: "σ", Sigma: "Σ",
  phi: "φ", epsilon: "ε", varepsilon: "ε", eta: "η", tau: "τ", degree: "°", circ: "°", therefore: "∴", because: "∵",
  propto: "∝", angle: "∠", perp: "⊥", parallel: "∥", ldots: "…", dots: "…", cdots: "…", quad: " ", qquad: " ",
};
const SIMPLE_TERM = /^[A-Za-z0-9.⁰¹²³⁴-⁹₀-₉]+$/;

function latexToUnicode(input: string): string {
  let s = input
    .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
    .replace(/\$([^$\n]*[\\^_{][^$\n]*)\$/g, "$1") // only real math, so "$100" currency survives
    .replace(/\\[()[\]]/g, "");
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s
      .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => sup(a))
      .replace(/_\{([^{}]*)\}/g, (_m, a: string) => sub(a))
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_m, a: string, b: string) => {
        const x = a.trim();
        const y = b.trim();
        return `${SIMPLE_TERM.test(x) ? x : `(${x})`}/${SIMPLE_TERM.test(y) ? y : `(${y})`}`;
      })
      .replace(/\\sqrt\s*\[3\]\s*\{([^{}]*)\}/g, "∛($1)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, a: string) => (SIMPLE_TERM.test(a.trim()) ? `√${a.trim()}` : `√(${a.trim()})`))
      .replace(/\\(?:text|mathrm|mathbf|textbf|mathit|textit|operatorname)\s*\{([^{}]*)\}/g, "$1");
    if (s === before) break;
  }
  return s
    .replace(/\\(?:left|right)(?![a-zA-Z])\s?/g, "")
    .replace(/\\[,;:!]/g, " ")
    .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => sup(a))
    .replace(/_\{([^{}]*)\}/g, (_m, a: string) => sub(a))
    .replace(/([A-Za-z)])_([0-9a-z])(?![A-Za-z])/g, (_m, a: string, b: string) => a + sub(b))
    .replace(/\\([a-zA-Z]+)/g, (_m, name: string) => LATEX_SYMBOLS[name] ?? name)
    .replace(/\\%/g, "%");
}

// ─── Chemistry helpers ───────────────────────────────────────────────────────
const ELEMENTS = new Set(
  ("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb " +
    "Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au " +
    "Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr").split(" "),
);
const CATIONS = "NH4|Na|Ca|Mg|Al|Fe|Cu|Zn|Pb|Ag|Ba|Sn|Mn|Cr|Ni|Co|Hg|Li|Sr|Au|K|H";
const ANIONS = "HCO3|HSO4|MnO4|Cr2O7|NO3|NO2|SO4|SO3|CO3|PO4|OH|Cl|Br|I|F|O|S";
const FORMULA_RE = /(^|[^A-Za-z])((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+)(?![A-Za-z])/g;

function chargeOf(digit: string, sign: string): string {
  return (digit ? sup(digit) : "") + sup(sign === "+" ? "+" : "-");
}

function chemistry(s: string, withCharges: boolean): string {
  let out = s;
  if (withCharges) {
    out = out
      .replace(new RegExp(`(^|[^A-Za-z])(${CATIONS})(\\d?)([+\\-−])(?![\\dA-Za-z])`, "g"), (_m, pre: string, symb: string, d: string, sg: string) => pre + symb + chargeOf(d, sg))
      .replace(new RegExp(`(^|[^A-Za-z])(${ANIONS})(\\d?)([+\\-−])(?![\\dA-Za-z])`, "g"), (_m, pre: string, symb: string, d: string, sg: string) => pre + symb + chargeOf(d, sg));
  }
  // general formulae of homologous series: CnH2n+2, CnH2n, CnH2n-2, CnH2n+1OH
  out = out.replace(/\bC([nxm])H(\d*)([nxm])?([+\-−]\d+)?(?![a-z\d])/g, (m, a: string, d: string, b: string | undefined, tail: string | undefined) => {
    const subscript = toSubscript(`${d}${b ?? ""}${tail ?? ""}`);
    return subscript ? `C${sub(a)}H${subscript}` : m;
  });
  // formulae: H2O → H₂O, Ca(OH)2 → Ca(OH)₂, 2H2 + O2 → 2H₂ + O₂ (only real element symbols are touched)
  out = out.replace(FORMULA_RE, (m, pre: string, token: string) => {
    if (!/\d/.test(token)) return m;
    const symbols = token.replace(/[\d()]/g, "").match(/[A-Z][a-z]?/g) ?? [];
    if (symbols.length === 0 || !symbols.every((x) => ELEMENTS.has(x))) return m;
    return pre + token.replace(/([A-Za-z)])(\d+)/g, (_x, a: string, d: string) => a + sub(d));
  });
  return out;
}

// ─── Symbols & units ─────────────────────────────────────────────────────────
function normalizeSymbols(input: string, opts: { chem: boolean; physChem: boolean; science: boolean; calc: boolean }): string {
  let s = input;

  // x^2, 10^-3, x^(n+1), e^x, 30^0 (degrees)
  s = s
    .replace(/\^\(([^()\n]{1,12})\)/g, (m, a: string) => toSuperscript(a) ?? m)
    .replace(/\^\{([^{}\n]{1,12})\}/g, (m, a: string) => toSuperscript(a) ?? m)
    .replace(/(\d+(?:\.\d+)?)\^0(?!\d)/g, (m, base: string) => (base !== "10" && (parseFloat(base) > 10 || base.indexOf(".") >= 0) ? `${base}°` : `${base}⁰`))
    .replace(/\^([+\-−]?\d+)/g, (m, a: string) => toSuperscript(a) ?? m)
    .replace(/\^([a-z])(?![a-zA-Z])/g, (m, a: string) => toSuperscript(a) ?? m);

  // arrows and comparison operators
  s = s
    .replace(/\s*<[-=]{1,3}>\s*/g, opts.chem ? " ⇌ " : " ⇔ ")
    .replace(/\s*-{1,3}>\s*/g, " → ")
    .replace(/\s*={1,2}>\s*/g, opts.chem ? " → " : " ⇒ ")
    .replace(/(\S)\s*<=\s*(\S)/g, "$1 ≤ $2")
    .replace(/(\S)\s*>=\s*(\S)/g, "$1 ≥ $2")
    .replace(/(\S)\s*!=\s*(\S)/g, "$1 ≠ $2");

  // multiplication: "2 x 3", "2*3", "(a)*(b)"
  s = s
    .replace(/(\d|\)|[⁰-⁹])\s+[xX]\s+(?=[\d(])/g, "$1 × ")
    .replace(/([\w)⁰-⁹])\s*\*(?!\*)\s*(?=[\w(])/g, "$1 × ");

  // sqrt(…) / sqrt 16, pi, simple fractions
  s = s
    .replace(/\bsqrt\s*\(/gi, "√(")
    .replace(/\bsqrt\s*(\d[\d.]*)/gi, "√$1")
    .replace(/\bpi\b/g, "π")
    .replace(/(^|[^\d./])(1\/2|1\/3|2\/3|1\/4|3\/4)(?![\d/])/g, (_m, pre: string, f: string) => {
      const glyph: Record<string, string> = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾" };
      return pre + glyph[f];
    });

  // units: cm3, dm3, 5 m2, m/s2, kg/m3, ms-1, mol dm-3, s-1 …
  s = s
    .replace(/(^|[^A-Za-z])(cm|dm|mm|km)([23])(?![\dA-Za-z])/g, (_m, pre: string, u: string, p: string) => pre + u + sup(p))
    .replace(/(\d\s?)m([23])(?![\dA-Za-z])/g, (_m, pre: string, p: string) => `${pre}m${sup(p)}`)
    .replace(/\/(s|m|cm|dm)([23])(?![\dA-Za-z])/g, (_m, u: string, p: string) => `/${u}${sup(p)}`)
    .replace(/(^|[^A-Za-z])(ms|mol|dm|cm|kg|Pa|Nm|kgm|gcm|moldm|Jmol|kJmol|Wm|Jkg|JK|Jg|Ckg|Vm|mm|km|s)[-−](\d)(?![\dA-Za-z])/g, (_m, pre: string, u: string, p: string) => pre + u + sup(`-${p}`));

  // formulae and ions (Chemistry, Biology, Physics) — before variable subscripts
  if (opts.science) s = chemistry(s, opts.chem);

  // V1, T2, R1, m1 … → V₁, T₂ (a couple of passes: "M1V1" needs the second to reach V1)
  if (opts.physChem) {
    for (let i = 0; i < 3; i++) {
      const next = s.replace(/(^|[^A-Za-z0-9_.])([A-Za-z])([1-4])(?![a-z\d])/g, (_m, pre: string, l: string, d: string) => pre + l + sub(d));
      if (next === s) break;
      s = next;
    }
  }
  return s;
}

// ─── Splitting a blob into steps ────────────────────────────────────────────
const EQ_START = /^[A-Za-zΔθλμρσωπαβγφΩ][A-Za-z0-9₀-₉ᵢⱼₙ]{0,5}(?:\([^()]*\))?\s*=\s*\S/;
const ABBREVIATION = /(?:e\.g|i\.e|Fig|No|Eq|Eqn|etc|vs|Dr|Mr|Mrs|approx|Vol|cf)$/i;
const STRONG_MARKER = /\s+(?=(?:Step\s*\d+|Given that|Given|Solution|Formula|Using|Substituting|Substitute|Applying|Therefore|Hence|Thus|Answer|Ans|Recall|Required|To find|Working)\b)/g;
const LIST_MARKER = /([.;:!?)])\s+(?=(?:\d{1,2}[.)]\s|\((?:i{1,3}|iv|vi{0,3}|ix|x|[a-e])\)\s|[a-e]\)\s))/g;
const LABEL_LINE = /^(Given that|Given|Where|Formula|Solution|Recall|Note|Required|Find|Working|Method)\s*:\s+(\S.*)$/i;

function splitSentences(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /([.!?])\s+(?=[A-Z(\d]|[A-Za-z][A-Za-z0-9₀-₉]{0,3}\s*=)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m[1] === "." && ABBREVIATION.test(line.slice(Math.max(0, m.index - 6), m.index))) continue;
    // "1." / "a." / "iii." at the start of a chunk is a list marker, not the end of a sentence
    if (m[1] === "." && /^(?:\d{1,2}|[a-e]|i{1,3}|iv|vi{0,3}|ix|x)$/i.test(line.slice(start, m.index).trim())) continue;
    out.push(line.slice(start, m.index + 1).trim());
    start = m.index + m[0].length;
  }
  out.push(line.slice(start).trim());
  return out.filter(Boolean);
}

/** Break "m = 2 kg, v = 3 m/s" and "F = ma; a = F/m" into one equation per line (outside brackets only). */
function splitAtEquationBreaks(line: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    else if ((c === "," || c === ";") && depth === 0 && /\s/.test(line.charAt(i + 1))) {
      const rest = line.slice(i + 1).trimStart();
      if (EQ_START.test(rest)) {
        out.push(line.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  out.push(line.slice(start).trim());
  return out.filter(Boolean);
}

const UNIT_WORD = /^(?:mol|moles?|g|kg|mg|N|J|kJ|W|V|A|m|s|cm|dm|mm|km|Pa|Hz|K|ohms?|Ω|°C|%)$/i;
const GLUED_EQ = /(\S+)\s+(?=[A-Z][a-z]{2,}(?:\s+(?:of|in|at)\s+[A-Za-z0-9₀-₉⁰-⁹()+]+)?\s*=\s)/g;

/** "… = 0.05 mol Concentration = 0.05/0.025" has no punctuation to split on: break before a new "Word =" equation. */
function splitGluedEquations(line: string): string[] {
  const out: string[] = [];
  let start = 0;
  let m: RegExpExecArray | null;
  GLUED_EQ.lastIndex = 0;
  while ((m = GLUED_EQ.exec(line)) !== null) {
    const prev = m[1];
    if (/\d|[⁰-⁹₀-₉)]/.test(prev) || UNIT_WORD.test(prev)) {
      out.push(line.slice(start, m.index + prev.length).trim());
      start = m.index + m[0].length;
    }
  }
  out.push(line.slice(start).trim());
  return out.filter(Boolean);
}

function looksLikeWorking(text: string): boolean {
  return /=/.test(text) || /\d\s*[×÷+\-−*/]\s*\d/.test(text);
}

function structureWorking(text: string): string {
  const result: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) {
      result.push("");
      continue;
    }
    const withListBreaks = rawLine.replace(LIST_MARKER, "$1\n");
    for (const chunk of withListBreaks.split("\n")) {
      for (const sentence of splitSentences(chunk)) {
        for (const piece of sentence.replace(STRONG_MARKER, "\n").split("\n")) {
          for (const glued of splitGluedEquations(piece)) {
            for (const rawPart of splitAtEquationBreaks(glued)) {
              // a full stop after an equation is just clutter ("… = 5 m/s².")
              const part = /[=→⇌⇒]/.test(rawPart) && /[^.]\.$/.test(rawPart) ? rawPart.slice(0, -1) : rawPart;
              const label = LABEL_LINE.exec(part);
              if (label) {
                result.push(`${label[1].charAt(0).toUpperCase()}${label[1].slice(1)}:`);
                result.push(label[2].trim());
              } else {
                result.push(part);
              }
            }
          }
        }
      }
    }
  }
  return result.join("\n");
}

// ─── Public: format ──────────────────────────────────────────────────────────
const CALC_SUBJECTS = new Set([
  "Mathematics", "Further Mathematics", "Physics", "Chemistry", "Biology", "Accounting", "Economics",
  "Agricultural Science", "Commerce", "Insurance",
]);
const SCIENCE_SUBJECTS = new Set(["Chemistry", "Physics", "Biology", "Agricultural Science"]);

/**
 * Make an explanation readable. Safe to run on text that is already formatted (it is idempotent),
 * which matters because saved attempts store the text exactly as it was formatted when saved.
 */
export function formatExplanationText(raw: string, subject?: string | null): string {
  let s = tidyLines(raw.replace(/\r\n?/g, "\n"));
  if (!s) return "";

  if (/\\[a-zA-Z()[\]]/.test(s) || /\$[^$\n]*[\\^_{]/.test(s)) s = latexToUnicode(s);

  const calcSubject = !!subject && CALC_SUBJECTS.has(subject);
  s = normalizeSymbols(s, {
    chem: subject === "Chemistry",
    physChem: subject === "Physics" || subject === "Chemistry",
    science: !!subject && SCIENCE_SUBJECTS.has(subject),
    calc: calcSubject,
  });

  // Step splitting only when this is worked calculation (so prose explanations keep their paragraphs)
  if ((calcSubject || !subject) && looksLikeWorking(s)) s = structureWorking(s);

  return tidyLines(s);
}

// ─── Public: parse into blocks for the UI ───────────────────────────────────
export type ExplanationBlock =
  | { kind: "label"; text: string; gap: boolean }
  | { kind: "step"; marker: string; text: string; gap: boolean }
  | { kind: "equation"; text: string; gap: boolean }
  | { kind: "answer"; text: string; gap: boolean }
  | { kind: "text"; text: string; gap: boolean };

const STEP_LINE = /^(?:Step\s*(\d+)\s*[:.)-]?\s*|(\d{1,2})[.)]\s+|\(((?:i{1,3}|iv|vi{0,3}|ix|x))\)\s+|\(([a-e])\)\s+|([a-e])\)\s+)(\S.*)$/i;
const ANSWER_LINE = /^(?:(?:Final\s+answer|Answer|Ans)\b\s*[:=.-]?\s*|∴\s*)(.*)$/i;
const CONCLUSION_LINE = /^(?:Therefore|Hence|Thus)\b/i;
const LABEL_ONLY = /^(Given that|Given|Where|Formula|Solution|Recall|Note|Required|Find|Working|Method):$/i;

function isEquationLine(line: string): boolean {
  if (!/[=→⇌⇒⇔≈]/.test(line) || line.length > 160) return false;
  const words = line.replace(/[A-Z][a-z]?\d*[₀-₉⁰-⁹⁺⁻]*/g, " ").match(/[A-Za-z]{4,}/g) ?? [];
  return words.length <= 2;
}

export function parseExplanation(text: string): ExplanationBlock[] {
  const blocks: ExplanationBlock[] = [];
  let gap = false;
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      gap = blocks.length > 0;
      return;
    }
    const isLast = lines.slice(i + 1).every((l) => !l.trim());
    const g = gap;
    gap = false;

    const label = LABEL_ONLY.exec(line);
    if (label) return void blocks.push({ kind: "label", text: label[1].charAt(0).toUpperCase() + label[1].slice(1).toLowerCase(), gap: g });

    const ans = ANSWER_LINE.exec(line);
    if (ans && ans[1].trim()) return void blocks.push({ kind: "answer", text: ans[1].trim(), gap: g });
    if (isLast && CONCLUSION_LINE.test(line) && /[=≈]|\d/.test(line)) return void blocks.push({ kind: "answer", text: line, gap: g });

    const step = STEP_LINE.exec(line);
    if (step && !isEquationLine(step[6])) {
      const marker = step[1] ? `Step ${step[1]}` : step[2] ?? (step[3] ? `(${step[3]})` : step[4] ? `(${step[4]})` : `${step[5]})`);
      return void blocks.push({ kind: "step", marker, text: step[6].trim(), gap: g });
    }
    if (isEquationLine(line)) return void blocks.push({ kind: "equation", text: line, gap: g });
    blocks.push({ kind: "text", text: line, gap: g });
  });
  return blocks;
}
