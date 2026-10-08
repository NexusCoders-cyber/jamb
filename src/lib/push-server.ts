/**
 * Web push (server side). Phones that switched notifications on are stored in public.push_subscriptions
 * (see supabase/push.sql). Needs VAPID keys in the environment — run `npm run vapid` to make a pair.
 *
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: address or your site URL)
 *
 * Without the keys nothing is sent and everything else keeps working.
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PUSH_TOPICS = ["blog", "announcements"] as const;
export type PushTopic = (typeof PUSH_TOPICS)[number];

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type Sender = (sub: PushSub, payload: string) => Promise<void>;

export type PushResult = {
  /** false when the VAPID keys are not set — nothing was sent */
  configured: boolean;
  targeted: number;
  sent: number;
  failed: number;
  /** phones that had uninstalled / revoked permission; they were removed */
  removed: number;
};

export function pushConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  if (!publicKey || !privateKey) return null;
  let subject = (process.env.VAPID_SUBJECT ?? "").trim();
  if (!/^(mailto:|https:\/\/)/.test(subject)) {
    const site = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
    subject = /^https:\/\//.test(site) ? site : "mailto:support@example.com";
  }
  return { publicKey, privateKey, subject };
}

/** Keeps a payload comfortably under the 4 KB push limit and free of control characters. */
export function cleanPayload(p: PushPayload): string {
  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const strip = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const url = typeof p.url === "string" && p.url.startsWith("/") && !p.url.startsWith("//") ? p.url.slice(0, 300) : "/notifications";
  return JSON.stringify({ title: clip(strip(p.title), 90), body: clip(strip(p.body), 180), url, tag: p.tag?.slice(0, 60) });
}

function defaultSender(): Sender | null {
  const cfg = pushConfig();
  if (!cfg) return null;
  return async (sub, payload) => {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
      { vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey }, TTL: 60 * 60 * 24, urgency: "normal" },
    );
  };
}

const PAGE = 1000;
const PARALLEL = 20;

/** Sends to every phone subscribed to `topic`. Never throws. */
export async function sendPush(
  admin: SupabaseClient,
  topic: PushTopic,
  payload: PushPayload,
  sender: Sender | null = defaultSender(),
): Promise<PushResult> {
  const result: PushResult = { configured: !!sender, targeted: 0, sent: 0, failed: 0, removed: 0 };
  if (!sender) return result;
  const body = cleanPayload(payload);
  const dead: string[] = [];

  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .contains("topics", [topic])
        .order("created_at")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      const subs = data as PushSub[];
      result.targeted += subs.length;

      for (let i = 0; i < subs.length; i += PARALLEL) {
        await Promise.all(
          subs.slice(i, i + PARALLEL).map(async (s) => {
            try {
              await sender(s, body);
              result.sent += 1;
            } catch (e) {
              const code = (e as { statusCode?: number }).statusCode;
              if (code === 404 || code === 410) dead.push(s.endpoint);
              else result.failed += 1;
            }
          }),
        );
      }
      if (subs.length < PAGE) break;
    }
    if (dead.length) {
      for (let i = 0; i < dead.length; i += 200) {
        await admin.from("push_subscriptions").delete().in("endpoint", dead.slice(i, i + 200));
      }
      result.removed = dead.length;
    }
  } catch (e) {
    console.warn("[push] send failed:", e instanceof Error ? e.message : e);
  }
  return result;
}

/** One in-app notification per student (shows on /notifications and the bell). Returns how many were created. */
export async function notifyEveryone(admin: SupabaseClient, n: { title: string; body: string; url?: string }): Promise<number> {
  let created = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from("profiles").select("id").order("id").range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (let i = 0; i < data.length; i += 500) {
      const chunk = (data as { id: string }[]).slice(i, i + 500);
      const withUrl = chunk.map((p) => ({ user_id: p.id, title: n.title, body: n.body, url: n.url ?? null }));
      let { error: insErr } = await admin.from("notifications").insert(withUrl);
      if (insErr && /url/.test(insErr.message)) {
        // push.sql not run yet: the notifications table has no url column
        ({ error: insErr } = await admin.from("notifications").insert(chunk.map((p) => ({ user_id: p.id, title: n.title, body: n.body }))));
      }
      if (!insErr) created += chunk.length;
    }
    if (data.length < PAGE) break;
  }
  return created;
}
