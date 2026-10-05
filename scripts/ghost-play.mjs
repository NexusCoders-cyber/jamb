/**
 * Test-only ghost duel driver. Signs in as ghost-duel@qubit-test.local and:
 *
 *   MODE=create-direct TO_ID=<userId> [SUBJECT=Mathematics]
 *     → creates a duel that RESERVES the seat for TO_ID (direct invite:
 *       guest_id set while waiting) — the invite lands in their Arena.
 *
 *   MODE=state MATCH_ID=<uuid>
 *     → prints the ghost's view of the match (one poll).
 *
 *   MODE=answer MATCH_ID=<uuid> [CHOICE=0]
 *     → answers the live question (duels are head-to-head: both players answer
 *       the same question at the same time, 25s per question).
 *
 *   MODE=answer-loop MATCH_ID=<uuid> [ROUNDS=2]
 *     → polls until the next question opens, answers it, repeats ROUNDS times.
 */
import { createClient } from "@supabase/supabase-js";

const mode = process.env.MODE;
const email = "ghost-duel@qubit-test.local";
const password = "GhostDuel!2026x";
const base = process.env.APP_URL ?? "http://localhost:3000";

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: signErr } = await client.auth.signInWithPassword({ email, password });
if (signErr) { console.error("signin failed:", signErr.message); process.exit(1); }
const H = { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` };

async function api(path, body, method = "POST") {
  const res = await fetch(`${base}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

if (mode === "create-direct") {
  const r = await api("/api/quiz/match", {
    subject: process.env.SUBJECT ?? "Mathematics",
    mode: "duel",
    guestId: process.env.TO_ID,
  });
  console.log("[ghost-play] create-direct:", r.status, JSON.stringify(r.json));
} else if (mode === "state") {
  const r = await api(`/api/quiz/match/${process.env.MATCH_ID}`, undefined, "GET");
  const s = r.json;
  console.log("[ghost-play] state:", r.status, s && typeof s === "object"
    ? JSON.stringify({ status: s.status, turn: s.currentTurn, myIdx: s.yourIndex, me: s.yourScore, opp: s.oppScore, oppName: s.oppName, prompt: s.question?.prompt?.slice(0, 60) })
    : JSON.stringify(r.json));
} else if (mode === "answer") {
  const r = await api(`/api/quiz/match/${process.env.MATCH_ID}`, { choice: Number(process.env.CHOICE ?? 0) });
  console.log("[ghost-play] answer:", r.status, JSON.stringify(r.json));
} else if (mode === "answer-loop") {
  const rounds = Number(process.env.ROUNDS ?? 2);
  for (let i = 0; i < rounds; i++) {
    let turned = false;
    for (let t = 0; t < 30 && !turned; t++) {
      const s = (await api(`/api/quiz/match/${process.env.MATCH_ID}`, undefined, "GET")).json;
      if (s.status !== "active") { console.log("[ghost-play] match is", s.status); process.exit(0); }
      if (s.currentTurn === s.yourSide && !s.yourFinished) {
        const q = s.question;
        // answer option 0 blindly — this is a sync test, not a brain test
        const r = await api(`/api/quiz/match/${process.env.MATCH_ID}`, { choice: Number(process.env.CHOICE ?? 0) });
        console.log(`[ghost-play] round ${i + 1} answered:`, r.status, JSON.stringify(r.json), "| q:", q?.prompt?.slice(0, 50));
        turned = true;
      } else {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!turned) console.log(`[ghost-play] round ${i + 1}: never saw the next question (45s)`);
  }
  console.log("[ghost-play] done");
} else {
  console.error("MODE must be create-direct | state | answer | answer-loop");
  process.exit(1);
}
