/**
 * Test-only ghost opponent: creates (or reuses) a throwaway auth user, signs
 * in, and claims an open duel seat through the join API — exactly what a
 * friend tapping the share link does.
 *
 * Usage: MATCH_ID=<uuid> node --env-file=.env.local scripts/ghost-join.mjs
 */
import { createClient } from "@supabase/supabase-js";

const matchId = process.env.MATCH_ID;
if (!matchId) {
  console.error("MATCH_ID required");
  process.exit(1);
}

const email = "ghost-duel@qubit-test.local";
const password = "GhostDuel!2026x";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let userId;
const { data: list } = await admin.auth.admin.listUsers();
const existing = list?.users?.find((u) => u.email === email);
if (existing) {
  userId = existing.id;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("create failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
}
await admin.from("profiles").upsert({ id: userId, full_name: "Duel Ghost" });
console.log("[ghost-join] user:", userId);

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: signErr } = await client.auth.signInWithPassword({ email, password });
if (signErr) {
  console.error("signin failed:", signErr.message);
  process.exit(1);
}

const base = process.env.APP_URL ?? "http://localhost:3000";
const res = await fetch(`${base}/api/quiz/match/join`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
  body: JSON.stringify({ matchId }),
});
console.log("[ghost-join] status:", res.status, await res.text());
