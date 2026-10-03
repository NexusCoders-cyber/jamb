/** List discount codes (metadata only) and seed QUBITTEST10 if none exist. */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing supabase env"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: codes, error } = await db.from("discount_codes").select("id, code, kind, value, active, used_count, max_uses, expires_at");
if (error) { console.log("SELECT ERROR:", error.message); process.exit(1); }
console.log("existing codes:", codes.length, "→", codes.map((c) => `${c.code}(${c.kind} ${c.value}, active=${c.active}, used=${c.used_count}/${c.max_uses ?? "∞"})`).join(" | ") || "(none)");

if (codes.length === 0) {
  const { data: created, error: insErr } = await db
    .from("discount_codes")
    .insert({ code: "QUBITTEST10", kind: "percent", value: 10, active: true, max_uses: 50 })
    .select("code, kind, value");
  console.log(insErr ? `SEED ERROR: ${insErr.message}` : `seeded: ${JSON.stringify(created)}`);
}
