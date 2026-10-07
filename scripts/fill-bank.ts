/**
 * Fill the question bank (public.question_bank) from ALOC — slowly, safely, and resumable.
 *
 *   npx tsx scripts/fill-bank.ts                      # every subject, years 2001 → this year
 *   npx tsx scripts/fill-bank.ts --subject mathematics,physics --years 2015-2025
 *   npx tsx scripts/fill-bank.ts --per-minute 12      # go gentler on ALOC
 *   npx tsx scripts/fill-bank.ts --force              # re-fetch even what the bank already holds (periodic re-sync)
 *   npx tsx scripts/fill-bank.ts --dry                # fetch + count, write nothing (no Supabase needed)
 *
 * Reads ALOC_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (or the environment).
 *
 * How it works
 *  • For every subject × exam year it asks ALOC for a random page of that year's questions (/m/120), saves the
 *    new ones straight away, and repeats until several pages in a row bring nothing new — i.e. the year is covered.
 *  • Requests are paced to --per-minute (default 20) and back off on HTTP 429 / 5xx, so it stays inside your
 *    ALOC plan. Safe to stop (Ctrl+C) and run again: finished subject/years are skipped unless --force.
 *  • Needs supabase/question_bank.sql to have been run once. English is saved too (with its passages) but is not
 *    served from the bank yet.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Env (.env.local → .env, never overriding what is already set) ───────────────────────────────────────────

function loadEnvFile(file: string): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let value = m[2];
    const quoted = /^(["'])(.*)\1$/.exec(value);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// ─── Options ─────────────────────────────────────────────────────────────────────────────────────────────────

export type Options = {
  subjects: string[]; // empty = all
  years: string[];
  perMinute: number;
  maxCalls: number; // ALOC pages per subject/year, at most
  stopAfter: number; // stop a subject/year after this many pages in a row with nothing new
  skipAt: number; // skip a subject/year the bank already holds this many questions for
  force: boolean;
  dry: boolean;
  help: boolean;
};

/** "2015-2025" → every year; "2019,2021" → those years. */
export function parseYears(spec: string): string[] {
  const out = new Set<string>();
  for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d{4})\s*-\s*(\d{4})$/.exec(part);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      for (let y = Math.min(a, b); y <= Math.max(a, b); y++) out.add(String(y));
    } else if (/^\d{4}$/.test(part)) {
      out.add(part);
    } else {
      throw new Error(`Bad --years value "${part}" (use 2015-2025 or 2019,2021)`);
    }
  }
  return Array.from(out).sort((x, y) => Number(y) - Number(x)); // newest first
}

export function parseArgs(argv: string[]): Options {
  const thisYear = new Date().getFullYear();
  const o: Options = {
    subjects: [],
    years: parseYears(`2001-${thisYear}`),
    perMinute: 20,
    maxCalls: 12,
    stopAfter: 3,
    skipAt: 40,
    force: false,
    dry: false,
    help: false,
  };
  const num = (flag: string, v: string | undefined, min: number, max: number): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${flag} needs a number between ${min} and ${max}`);
    return Math.floor(n);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--subject" || a === "--subjects") o.subjects = (next() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--years") o.years = parseYears(next() ?? "");
    else if (a === "--per-minute") o.perMinute = num(a, next(), 1, 120);
    else if (a === "--max-calls") o.maxCalls = num(a, next(), 1, 60);
    else if (a === "--stop-after") o.stopAfter = num(a, next(), 1, 10);
    else if (a === "--skip-at") o.skipAt = num(a, next(), 1, 1000);
    else if (a === "--force") o.force = true;
    else if (a === "--dry") o.dry = true;
    else if (a === "--help" || a === "-h") o.help = true;
    else throw new Error(`Unknown option ${a} (try --help)`);
  }
  return o;
}

const HELP = `Fill the question bank from ALOC.

  --subject a,b        only these subjects (name or slug, e.g. mathematics,"English Language")
  --years 2015-2025    years to fetch (also 2019,2021). Default: 2001 → this year
  --per-minute N       ALOC requests per minute (default 20)
  --max-calls N        most pages per subject/year (default 12)
  --stop-after N       stop a subject/year after N pages in a row with nothing new (default 3)
  --skip-at N          skip a subject/year the bank already holds N+ questions for (default 40)
  --force              ignore --skip-at and fetch everything again (periodic re-sync)
  --dry                fetch and count only; write nothing
`;

// ─── Main ────────────────────────────────────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }

  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const apiKey = (process.env.ALOC_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("ALOC_API_KEY is missing (put it in .env.local).");
  if (!opts.dry && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to save (or use --dry).");
  }

  // Imported only now, because aloc.ts reads ALOC_BASE_URL etc. when it loads — after the env file is in place.
  const aloc = await import("../src/lib/aloc");
  const bank = await import("../src/lib/question-bank");

  const wanted = new Set(opts.subjects.map((s) => s.toLowerCase()));
  const subjects = aloc.ALOC_SUBJECTS.filter(
    (s) => wanted.size === 0 || wanted.has(s.slug) || wanted.has(s.name.toLowerCase()),
  );
  if (subjects.length === 0) throw new Error(`No matching subject. Known: ${aloc.ALOC_SUBJECTS.map((s) => s.slug).join(", ")}`);

  const gapMs = Math.ceil(60000 / opts.perMinute);
  let lastCall = 0;
  const pace = async () => {
    const wait = lastCall + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
  };

  /** One ALOC page. Returns the questions, or "none" (nothing exists for this subject/year). Aborts on a bad key. */
  async function fetchPage(name: string, year: string, english: boolean) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await pace();
      try {
        return await aloc.fetchAlocMany(apiKey, name, 120, { year, type: "utme", withComprehension: english });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/HTTP (401|403)\b/.test(msg)) throw new Error(`ALOC rejected the key (${msg}). Check ALOC_API_KEY.`);
        if (/HTTP 404\b/.test(msg)) return "none" as const;
        const limited = /HTTP 429\b/.test(msg);
        const waitS = limited ? 70 : 15 * (attempt + 1);
        console.warn(`    ${limited ? "rate limited" : "hiccup"} (${msg}) — waiting ${waitS}s`);
        await sleep(waitS * 1000);
      }
    }
    throw new Error(`ALOC kept failing for ${name} ${year}; stopping so nothing is hammered. Run again later.`);
  }

  console.log(
    `Filling the bank: ${subjects.length} subject(s) × ${opts.years.length} year(s), ${opts.perMinute} requests/min` +
      `${opts.dry ? "  [DRY RUN — nothing is written]" : ""}\n`,
  );

  let totalSeen = 0;
  let totalSaved = 0;
  let combos = 0;

  for (const subject of subjects) {
    const english = subject.slug === "english";
    let subjectSeen = 0;
    console.log(`■ ${subject.name}`);

    for (const year of opts.years) {
      combos++;
      if (!opts.dry && !opts.force) {
        const have = await bank.bankCount(subject.name, year);
        if (have >= opts.skipAt) {
          console.log(`  ${year}: already has ${have} — skipped`);
          continue;
        }
      }

      const seen = new Set<string>();
      let stagnant = 0;
      let saved = 0;
      for (let call = 0; call < opts.maxCalls && stagnant < opts.stopAfter; call++) {
        const page = await fetchPage(subject.name, year, english);
        if (page === "none" || page.length === 0) {
          if (call === 0) break; // ALOC has nothing for this subject/year
          stagnant++;
          continue;
        }
        const fresh = page.filter((q) => {
          const key = bank.bankKey(subject.name, q);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        stagnant = fresh.length === 0 ? stagnant + 1 : 0;
        if (fresh.length > 0 && !opts.dry) {
          const written = await bank.saveToBank(subject.name, fresh);
          if (written === 0 && fresh.length >= 5) {
            throw new Error(
              "Could not save to the question bank. Has supabase/question_bank.sql been run, and are the Supabase keys right?",
            );
          }
          saved += written;
        }
      }
      subjectSeen += seen.size;
      totalSeen += seen.size;
      totalSaved += saved;
      console.log(seen.size === 0 ? `  ${year}: nothing from ALOC` : `  ${year}: ${seen.size} questions${opts.dry ? "" : `, ${saved} saved`}`);
    }
    console.log(`  → ${subjectSeen} questions seen for ${subject.name}\n`);
  }

  console.log(`Done. ${combos} subject/year combinations, ${totalSeen} questions seen${opts.dry ? "" : `, ${totalSaved} saved`}.`);
  if (!opts.dry) {
    const stats = await bank.bankStats();
    if (stats) {
      console.log("\nBank now holds:");
      for (const s of stats) console.log(`  ${s.subject.padEnd(32)} ${String(s.total).padStart(6)}  (${s.withImages} with pictures)`);
    }
  }
}

// Run only when executed directly (the exports above stay importable for tests)
if (process.argv[1] && /fill-bank\.[cm]?[jt]s$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(`\n✖ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
