/**
 * Test-only ghost client: joins the "online-users" presence channel as a
 * chosen user id so presence can be verified end-to-end from a terminal.
 *
 * Usage:
 *   GHOST_ID=<user-uuid> node scripts/ghost-presence.mjs
 * Tracks the global channel for 20s, then untracks for 10s, then exits.
 * Optional: DUEL_ID=<matchId> CHAT_TEXT="..." also joins the duel channel
 * and broadcasts one chat message (for testing in-game chat).
 * (Anon key only — presence channels need no auth; nothing touches the DB.)
 */
import { createClient } from "@supabase/supabase-js";

const ghostId = process.env.GHOST_ID;
if (!ghostId) {
  console.error("GHOST_ID required");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const channel = supabase.channel("online-users");

const duelId = process.env.DUEL_ID;
const chatText = process.env.CHAT_TEXT;
let duelChannel = null;

let tracked = false;
channel
  .on("presence", { event: "sync" }, () => {
    console.log("[ghost] sync:", JSON.stringify(channel.presenceState()));
  })
  .subscribe(async (status) => {
    console.log("[ghost] status:", status);
    if (status === "SUBSCRIBED" && !tracked) {
      tracked = true;
      await channel.track({ user_id: ghostId });
      console.log("[ghost] tracked as", ghostId);
      if (duelId && chatText) {
        duelChannel = supabase.channel(`duel-${duelId}`, { config: { presence: { key: `${ghostId}:ghost` } } });
        duelChannel.subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            await duelChannel.track({ user_id: ghostId });
            await duelChannel.send({
              type: "broadcast",
              event: "chat",
              payload: { id: crypto.randomUUID(), user_id: ghostId, name: "Isaiah", text: chatText, at: new Date().toISOString() },
            });
            console.log("[ghost] chat sent to duel channel");
          }
        });
      }
      setTimeout(async () => {
        await channel.untrack();
        console.log("[ghost] untracked — should vanish from dots");
        setTimeout(() => {
          console.log("[ghost] done");
          process.exit(0);
        }, 10_000);
      }, 20_000);
    }
  });
