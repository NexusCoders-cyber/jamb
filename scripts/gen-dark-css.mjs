#!/usr/bin/env node
/**
 * Generates src/app/dark.css — the dark-mode colour overrides.
 *
 * The app is styled with Tailwind colour classes (bg-white, text-slate-900, ring-violet-100 …).
 * Instead of hand-editing 100 files, this script scans src/ for every colour class that is actually
 * used and writes one override per class under `.dark`. It runs automatically before `dev` and `build`
 * (see package.json), so a class you add tomorrow is covered without touching anything.
 *
 *   node scripts/gen-dark-css.mjs          → rewrite src/app/dark.css
 *   node scripts/gen-dark-css.mjs --check  → exit 1 if dark.css is out of date (for CI)
 *
 * Rules of thumb it follows:
 *   • surfaces (bg-white, bg-slate-50/100/200, pale tints) become dark surfaces
 *   • text-slate-900…400 and dark text on tints become light text
 *   • borders / rings / dividers become dark borders
 *   • solid brand fills (bg-violet-600, bg-emerald-500 …), white text and gradients are left alone
 *   • an element that has BOTH a bright fill and dark text (e.g. amber button + slate text) keeps its dark text
 *   • mark an element `keep-light` to stop a white background turning dark (used for diagrams)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "app", "dark.css");

// ─── palette ────────────────────────────────────────────────────────────────
const PAGE = "#0d0c18";
const CARD = "#1b1a31"; // bg-white
const BASE = "#141327"; // what tints are mixed into
const SLATE_BG = { 50: "#151428", 100: "#232240", 200: "#2c2b4c", 300: "#3b3a5f" };
const SLATE_BG_HOVER = { 50: "#201f3a", 100: "#2a2950", 200: "#34335a", 300: "#43426a" };
const SLATE_FILL = { 700: "#3a3961", 800: "#2a2950", 900: "#2d2c52", 950: "#0a0914" };
const SLATE_FILL_HOVER = { 700: "#454470", 800: "#363560", 900: "#383762", 950: "#15142a" };
const SLATE_BORDER = { 50: "#1d1c36", 100: "#24233f", 200: "#2e2d4e", 300: "#3d3c62" };
const SLATE_TEXT = { 950: "#f8f7ff", 900: "#f4f3ff", 800: "#e7e5fb", 700: "#d5d2ee", 600: "#bcb9d9", 500: "#a3a0c4", 400: "#8c89ae" };

// Tailwind palette fallbacks (used only if the theme variable is not emitted)
const FAMILY = {
  violet: { 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6" },
  emerald: { 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981" },
  rose: { 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e" },
  amber: { 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b" },
  orange: { 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316" },
  blue: { 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6" },
  red: { 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444" },
  sky: { 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9" },
  green: { 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e" },
  yellow: { 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308" },
  teal: { 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4", 400: "#2dd4bf", 500: "#14b8a6" },
  indigo: { 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1" },
  purple: { 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7" },
  pink: { 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899" },
  cyan: { 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4" },
  lime: { 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635", 500: "#84cc16" },
  fuchsia: { 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef" },
};
const NEUTRAL_FAMILIES = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
const fam = (f, n) => `var(--color-${f}-${n}, ${FAMILY[f]?.[n] ?? "#888"})`;
// tint strength by shade for backgrounds / borders
const TINT_BG = { 50: 11, 100: 17, 200: 25 };
const TINT_BG_HOVER = { 50: 15, 100: 21, 200: 29 };
const TINT_BORDER = { 50: 20, 100: 26, 200: 32, 300: 40 };
const mixTint = (f, pct) => `color-mix(in srgb, ${fam(f, 500)} ${pct}%, ${BASE})`;

// ─── helpers ────────────────────────────────────────────────────────────────
const hexToRgb = (h) => {
  let x = h.replace("#", "");
  if (x.length === 3 || x.length === 4) x = x.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const withAlpha = (color, alpha) => (alpha == null ? color : `color-mix(in srgb, ${color} ${alpha}%, transparent)`);
const esc = (s) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);

// ─── colour mapping: returns the dark value for a utility, or null to leave it alone ─
const FAMS = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const TOKEN = new RegExp(
  `^((?:[a-z0-9-]+:)*)(bg|text|border|border-[trblxy]|ring|ring-offset|divide|from|via|to|placeholder:text|outline|fill|stroke)-(white|black|transparent|current|(?:${FAMS})-\\d{2,3}|\\[#[0-9a-fA-F]{3,8}\\])(?:/(\\d{1,3}))?$`,
);

function darkValue(role, color, hover, alpha) {
  const kind = role === "bg" || role === "from" || role === "via" || role === "to" ? "bg" : role === "text" || role === "fill" || role === "stroke" || role === "placeholder:text" ? "text" : "line";
  let v = null;

  if (color === "white") {
    if (kind === "bg") {
      if (alpha != null && alpha < 60) return null; // translucent white = a highlight on a coloured card
      v = hover ? "#232140" : CARD;
    } else if (kind === "line") {
      if (alpha != null) return null;
      v = CARD;
    } else return null; // text-white stays white
  } else if (color === "black" || color === "transparent" || color === "current") {
    return null;
  } else if (color.startsWith("[#")) {
    const hex = color.slice(2, -1);
    if (!/^#?[0-9a-fA-F]{3,8}$/.test(hex)) return null;
    const h = `#${hex.replace("#", "")}`;
    const L = lum(h.length > 7 ? h.slice(0, 7) : h);
    if (kind === "bg") {
      if (h.toLowerCase() === "#f5f4ff") v = PAGE;
      else if (L > 0.72) v = `color-mix(in srgb, ${h} ${hover ? 22 : 16}%, ${BASE})`;
      else return null;
    } else if (kind === "text") {
      if (L < 0.08) v = "#f1f0ff";
      else if (L < 0.22) v = `color-mix(in srgb, ${h} 32%, #ffffff)`;
      else if (L < 0.4) v = `color-mix(in srgb, ${h} 55%, #ffffff)`;
      else return null;
    } else {
      if (L > 0.8) v = `color-mix(in srgb, ${h} 22%, ${BASE})`;
      else return null;
    }
  } else {
    const [f, nStr] = [color.slice(0, color.lastIndexOf("-")), color.slice(color.lastIndexOf("-") + 1)];
    const n = Number(nStr);
    if (NEUTRAL_FAMILIES.has(f)) {
      if (f !== "slate") return null; // only slate is used in this app; other neutrals are left alone
      if (kind === "bg") {
        if (n <= 300) v = (hover ? SLATE_BG_HOVER : SLATE_BG)[n] ?? null;
        else if (n >= 700) v = (hover ? SLATE_FILL_HOVER : SLATE_FILL)[n] ?? null;
      } else if (kind === "text") v = SLATE_TEXT[n] ?? null;
      else v = n <= 300 ? SLATE_BORDER[n] ?? null : null;
    } else if (FAMILY[f]) {
      if (kind === "bg") v = n <= 200 ? mixTint(f, (hover ? TINT_BG_HOVER : TINT_BG)[n]) : null;
      else if (kind === "text") v = n >= 950 ? fam(f, 100) : n === 900 ? fam(f, 100) : n === 800 ? fam(f, 200) : n === 700 ? fam(f, 300) : n === 600 ? fam(f, 400) : null;
      else v = n <= 300 ? mixTint(f, TINT_BORDER[n]) : null;
    } else return null;
  }
  return v == null ? null : withAlpha(v, alpha);
}

// is this bg token a bright fill that stays bright in dark mode? (dark text on it must stay dark)
function isBrightFill(color) {
  if (color.startsWith("[#")) {
    const h = `#${color.slice(2, -1).replace("#", "")}`;
    return lum(h.length > 7 ? h.slice(0, 7) : h) > 0.4 && darkValue("bg", color, false, null) === null;
  }
  const i = color.lastIndexOf("-");
  const f = color.slice(0, i);
  const n = Number(color.slice(i + 1));
  if (f === "white" || NEUTRAL_FAMILIES.has(f)) return false;
  return n === 300 || n === 400 || (n === 500 && ["amber", "yellow", "lime", "orange"].includes(f));
}
const isDarkText = (role, color) => {
  if (role !== "text") return false;
  if (color.startsWith("[#")) return lum(`#${color.slice(2, -1).replace("#", "")}`) < 0.3;
  const i = color.lastIndexOf("-");
  const n = Number(color.slice(i + 1));
  return !["white", "black"].includes(color) && n >= 600;
};

// ─── selectors / properties ─────────────────────────────────────────────────
const BREAKPOINTS = { sm: "40rem", md: "48rem", lg: "64rem", xl: "80rem", "2xl": "96rem" };
const PSEUDO = { hover: ":hover", focus: ":focus", "focus-visible": ":focus-visible", "focus-within": ":focus-within", active: ":active", disabled: ":disabled", checked: ":checked", first: ":first-child", last: ":last-child", odd: ":nth-child(odd)", even: ":nth-child(even)", placeholder: "::placeholder" };

function declsFor(role, value) {
  switch (role) {
    case "bg": return `background-color: ${value};`;
    case "text": case "placeholder:text": return `color: ${value};`;
    case "fill": return `fill: ${value};`;
    case "stroke": return `stroke: ${value};`;
    case "border": return `border-color: ${value};`;
    case "border-t": return `border-top-color: ${value};`;
    case "border-b": return `border-bottom-color: ${value};`;
    case "border-l": return `border-left-color: ${value};`;
    case "border-r": return `border-right-color: ${value};`;
    case "border-x": return `border-left-color: ${value}; border-right-color: ${value};`;
    case "border-y": return `border-top-color: ${value}; border-bottom-color: ${value};`;
    case "ring": return `--tw-ring-color: ${value};`;
    case "ring-offset": return `--tw-ring-offset-color: ${value};`;
    case "outline": return `outline-color: ${value};`;
    case "from": return `--tw-gradient-from: ${value};`;
    case "via": return `--tw-gradient-via: ${value};`;
    case "to": return `--tw-gradient-to: ${value};`;
    default: return null;
  }
}

function buildRule(token, m, value) {
  const [, variantStr, role, color, alpha] = m;
  const variants = variantStr ? variantStr.split(":").filter(Boolean) : [];
  let media = null;
  let pseudo = "";
  let groupHover = false;
  for (const v of variants) {
    if (BREAKPOINTS[v]) media = BREAKPOINTS[v];
    else if (v === "group-hover") groupHover = true;
    else if (PSEUDO[v]) pseudo += PSEUDO[v];
    else return { skipped: `unsupported variant "${v}" in ${token}` };
  }
  const cls = `.${esc(token)}`;
  let sel;
  if (role === "divide") {
    sel = `.dark ${cls} > :not(:last-child)`;
    return { media, css: `${sel} { border-color: ${value}; }` };
  }
  if (groupHover) sel = `.dark .group:hover ${cls}`;
  else sel = `.dark ${cls}${pseudo}`;
  const d = declsFor(role, value);
  if (!d) return { skipped: `no property for role ${role}` };
  return { media, css: `${sel} { ${d} }` };
}

// ─── scan ───────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

const tokens = new Map(); // token -> match
const pairs = new Map(); // ".bg-x.text-y" -> decl
const warnings = [];

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8");
  // every string-ish chunk is a candidate class list
  const chunks = text.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) ?? [];
  for (const chunk of chunks) {
    const parts = chunk.split(/[\s"'`{}(),;<>=?:|&+*!]+/).length; // cheap pre-filter
    if (parts < 1) continue;
    const found = [];
    // keep variant prefixes (they contain ":"), so split only on whitespace/quotes/braces
    for (const raw of chunk.split(/[\s"'`{}(),;<>=]+/)) {
      const m = raw.match(TOKEN);
      if (!m) continue;
      tokens.set(raw, m);
      found.push({ raw, m });
    }
    // co-occurrence: bright fill + dark text on the same element keeps its dark text
    const fills = found.filter((f) => f.m[2] === "bg" && !f.m[1] && isBrightFill(f.m[3]));
    const texts = found.filter((f) => !f.m[1] && isDarkText(f.m[2], f.m[3]) && darkValue("text", f.m[3], false, f.m[4] ? Number(f.m[4]) : null));
    for (const fl of fills) {
      for (const tx of texts) {
        const c = tx.m[3];
        // the element's ORIGINAL (light-mode) text colour
        let orig;
        if (c.startsWith("[#")) orig = `#${c.slice(2, -1).replace("#", "")}`;
        else if (c.startsWith("slate-")) orig = { 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" }[Number(c.slice(6))] ?? "#1e293b";
        else orig = `var(--color-${c})`; // emitted by Tailwind because the class is used
        pairs.set(`.dark .${esc(fl.raw)}.${esc(tx.raw)}`, `color: ${withAlpha(orig, tx.m[4] ? Number(tx.m[4]) : null)};`);
      }
    }
  }
}

const base = [];
const hovers = [];
const responsive = new Map();
let count = 0;
for (const [token, m] of [...tokens.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const [, variantStr, role, color, alphaStr] = m;
  const alpha = alphaStr ? Number(alphaStr) : null;
  const hover = /(^|:)hover(:|$)/.test(variantStr);
  const value = darkValue(role, color, hover, alpha);
  if (value == null) continue;
  const r = buildRule(token, m, value);
  if (r.skipped) {
    warnings.push(r.skipped);
    continue;
  }
  count++;
  if (r.media) {
    if (!responsive.has(r.media)) responsive.set(r.media, []);
    responsive.get(r.media).push(r.css);
  } else if (variantStr) hovers.push(r.css);
  else base.push(r.css);
}

const header = `/* ──────────────────────────────────────────────────────────────────────────────
   GENERATED FILE — do not edit by hand.
   Source: scripts/gen-dark-css.mjs   (runs automatically before \`dev\` and \`build\`)
   Dark-mode colour overrides for every Tailwind colour class used in src/.
   ${count} rules.
   ────────────────────────────────────────────────────────────────────────────── */
`;
const footer = `
/* Elements that have a bright fill AND dark text keep that dark text */
${[...pairs.entries()].map(([sel, d]) => `${sel} { ${d} }`).join("\n")}

/* Opt-out: anything marked keep-light stays light (diagrams, photos on white) */
.dark .bg-white.keep-light { background-color: #ffffff; }
`;
const css =
  header +
  base.join("\n") +
  "\n\n/* state variants */\n" +
  hovers.join("\n") +
  "\n" +
  [...responsive.entries()].map(([w, rules]) => `\n@media (min-width: ${w}) {\n${rules.map((r) => "  " + r).join("\n")}\n}`).join("\n") +
  "\n" +
  footer;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== css) {
    console.error("dark.css is out of date — run: node scripts/gen-dark-css.mjs");
    process.exit(1);
  }
  console.log("dark.css is up to date");
} else {
  fs.writeFileSync(OUT, css);
  console.log(`dark.css: ${count} rules from ${tokens.size} colour classes, ${pairs.size} bright-fill text fixes`);
  for (const w of warnings) console.warn("  skipped:", w);
}
