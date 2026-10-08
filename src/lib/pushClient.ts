/** Phone notifications (browser side). The server half is lib/push-server.ts. */

export type PushTopicId = "blog" | "announcements";
export const ALL_TOPICS: PushTopicId[] = ["blog", "announcements"];

export type PushSupport = "ok" | "unsupported" | "needs-install" | "blocked";

/** Can this browser do push, and has the user blocked it? iPhone Safari only supports it once the app is added to the home screen. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return "ok";
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  try {
    const r = await fetch("/api/push/config", { cache: "no-store" });
    if (!r.ok) return { enabled: false, publicKey: null };
    return await r.json();
  } catch {
    return { enabled: false, publicKey: null };
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === "unsupported" || pushSupport() === "needs-install") return null;
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return { ok: true };
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: j.error ?? "Something went wrong." };
  } catch {
    return { ok: false, error: "You're offline. Connect to the internet and try again." };
  }
}

/** Where this phone stands on the server: registered or not, and for which topics. */
export async function serverStatus(endpoint: string): Promise<{ subscribed: boolean; topics: PushTopicId[] } | null> {
  try {
    const r = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { subscribed: boolean; topics: PushTopicId[] };
    return { subscribed: j.subscribed, topics: (j.topics ?? []).filter((t) => ALL_TOPICS.includes(t)) };
  } catch {
    return null;
  }
}

/** Ask permission (must be called from a tap), subscribe this phone, and register it with the server. */
export async function enablePush(topics: PushTopicId[] = ALL_TOPICS): Promise<{ ok: boolean; error?: string }> {
  const support = pushSupport();
  if (support === "needs-install") return { ok: false, error: "On iPhone, add Qubit to your Home Screen first, then switch notifications on from there." };
  if (support === "unsupported") return { ok: false, error: "This browser can't show notifications." };
  if (support === "blocked") return { ok: false, error: "Notifications are blocked for Qubit. Allow them in your browser or phone settings, then try again." };

  const cfg = await getPushConfig();
  if (!cfg.enabled || !cfg.publicKey) return { ok: false, error: "Notifications aren't switched on for this app yet. Please try again later." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, error: "Permission wasn't given, so no notifications will be sent." };

  const reg = await registration();
  if (!reg) return { ok: false, error: "Couldn't start the background service. Reload the app and try again." };
  let sub = await reg.pushManager.getSubscription();
  try {
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) });
  } catch {
    // an old subscription made with a different key blocks a new one: clear it and retry once
    try {
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) });
    } catch {
      return { ok: false, error: "This phone couldn't subscribe to notifications." };
    }
  }
  const res = await post("/api/push/subscribe", { subscription: sub.toJSON(), topics });
  if (!res.ok) { return res; }
  return { ok: true };
}

export async function setTopics(topics: PushTopicId[]): Promise<{ ok: boolean; error?: string }> {
  const sub = await currentSubscription();
  if (!sub) return { ok: false, error: "Notifications are off on this phone." };
  return post("/api/push/subscribe", { subscription: sub.toJSON(), topics });
}

export async function disablePush(): Promise<{ ok: boolean; error?: string }> {
  const sub = await currentSubscription();
  if (!sub) return { ok: true };
  const res = await post("/api/push/unsubscribe", { endpoint: sub.endpoint });
  if (!res.ok) return res;           // keep the browser subscription until the server forgot it
  try { await sub.unsubscribe(); } catch { /* already gone */ }
  return { ok: true };
}

/**
 * If this phone already allows notifications, tell the server who is signed in on it now (keeps the right account
 * attached after someone logs in or switches accounts). Cheap and silent; once per browser session.
 */
export async function resyncPush(): Promise<void> {
  try {
    if (pushSupport() !== "ok" || Notification.permission !== "granted") return;
    if (sessionStorage.getItem("qubit_push_synced") === "1") return;
    const sub = await currentSubscription();
    if (!sub) return;
    const status = await serverStatus(sub.endpoint);
    if (status === null) return;     // offline / server trouble — try next time
    sessionStorage.setItem("qubit_push_synced", "1");
    // Keep the topics the server already has for this phone; register it again if the server lost it
    await post("/api/push/subscribe", { subscription: sub.toJSON(), topics: status.subscribed ? status.topics : ALL_TOPICS });
  } catch { /* never break the app over notifications */ }
}
