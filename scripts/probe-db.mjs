/**
 * Live probe of the Supabase project — checks which tables, columns, buckets
 * and RPCs from supabase/*.sql are actually applied. Uses the service-role
 * key from .env.local (read-only HTTP calls; never mutates data).
 *
 * Run: node scripts/probe-db.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const headers = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
};

async function get(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    return { error: `${res.status} ${text.slice(0, 160)}` };
  }
  return { data: await res.json() };
}

const results = {};
function record(name, ok, detail) {
  results[name] = { ok, detail };
  console.log(`${ok ? "✅" : "❌"} ${name.padEnd(28)} ${detail}`);
}

// ── 1. Tables (via a cheap select with limit 0) ───────────────────────────────
const TABLES = [
  "profiles", "subjects", "questions", "exam_attempts", "attempt_answers",
  "notifications", "payments", "channels", "posts", "post_replies",
  "direct_messages", "blog_posts", "syllabus_items", "promos",
];
console.log("── Tables (REST head query) ──");
for (const t of TABLES) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=0`, { headers });
  const ok = res.ok;
  record(`table:${t}`, ok, ok ? "exists" : `missing (${res.status})`);
}

// ── 2. Key columns (select them; error = column absent) ───────────────────────
const COLUMNS = [
  ["profiles", "role"],
  ["profiles", "target_score"],
  ["profiles", "interests"],
  ["profiles", "course"],
  ["profiles", "avatar_url"],
  ["profiles", "bio"],
  ["attempt_answers", "question_data"],
  ["direct_messages", "reply_to_id"],
];
console.log("\n── Columns ──");
for (const [t, c] of COLUMNS) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=${c}&limit=1`, { headers });
  record(`col:${t}.${c}`, res.ok, res.ok ? "exists" : `missing (${res.status})`);
}

// ── 3. Storage buckets (storage API, not PostgREST) ─────────────────────────────
console.log("\n── Storage buckets ──");
let buckets = null;
try {
  const res = await fetch(`${URL_}/storage/v1/bucket`, { headers });
  if (res.ok) buckets = await res.json();
  else record("storage.buckets", false, `storage API ${res.status}`);
} catch (e) {
  record("storage.buckets", false, String(e).slice(0, 80));
}
if (buckets) {
  const have = new Set((buckets ?? []).map((b) => b.id));
  for (const b of ["avatars", "syllabus", "promos"]) {
    const meta = (buckets ?? []).find((x) => x.id === b);
    record(`bucket:${b}`, have.has(b), meta ? `public=${meta.public} limit=${meta.file_size_limit ?? "none"}` : "missing");
  }
}

// ── 4. RPCs (PostgREST will 404 with PGRST202 if function missing) ────────────
console.log("\n── RPC functions ──");
for (const fn of ["suggested_people", "public_profile_stats"]) {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(fn === "public_profile_stats" ? { uid: "00000000-0000-0000-0000-000000000000" } : {}),
  });
  const ok = res.status !== 404;
  let detail = ok ? "exists" : "missing (404)";
  if (ok && res.status >= 400) {
    const body = await res.json().catch(() => ({}));
    // 42501 / 403 style errors still prove the function exists
    detail = `exists (runtime: ${res.status} ${body.message ?? ""}`.slice(0, 90) + ")";
  }
  record(`rpc:${fn}`, ok, detail);
}

// ── 5. Realtime publication (direct_messages must be added) ──────────────────
console.log("\n── Row counts (sanity) ──");
for (const [t, label] of [["profiles", "profiles"], ["direct_messages", "DMs"], ["notifications", "notifications"], ["syllabus_items", "syllabus entries"], ["promos", "promos"]]) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1000`, { headers });
  if (res.ok) {
    const rows = await res.json();
    record(`count:${label}`, true, `${rows.length}${rows.length === 1000 ? "+" : ""} rows`);
  } else {
    record(`count:${label}`, false, `n/a (${res.status})`);
  }
}

console.log("\n── Summary ──");
const fails = Object.entries(results).filter(([, r]) => !r.ok);
if (fails.length === 0) {
  console.log("All checks passed — everything is applied and connected.");
} else {
  console.log(`${fails.length} item(s) missing. Run the SQL file(s) that own them:`);
  console.log("  • direct_messages.reply_to_id, syllabus_items, promos, buckets  → supabase/syllabus_promos_dm.sql");
  console.log("  • blog_posts, admin policies                                    → supabase/admin_and_blog.sql");
  console.log("  • suggested_people()                                            → supabase/suggested_people.sql");
  console.log("  • community tables                                              → supabase/community.sql");
  console.log("  • base schema                                                   → supabase/schema_safe.sql");
}
