"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useUser } from "@/lib/useUser";
import {
  ALL_TOPICS, currentSubscription, disablePush, enablePush, getPushConfig, pushSupport, serverStatus, setTopics,
  type PushSupport, type PushTopicId,
} from "@/lib/pushClient";

const LABEL: Record<PushTopicId, { title: string; hint: string }> = {
  blog: { title: "New articles", hint: "When we publish a new study guide or update on the blog" },
  announcements: { title: "Announcements", hint: "Important news from the Qubit team" },
};

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-violet-600" : "bg-slate-300"} disabled:opacity-50`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/** Settings → Notifications: switch phone notifications on/off, and pick what to hear about. */
export default function NotificationSettings() {
  const { user } = useUser();
  const [support, setSupport] = useState<PushSupport>("ok");
  const [serverReady, setServerReady] = useState(true);
  const [on, setOn] = useState(false);
  const [topics, setTopicsState] = useState<PushTopicId[]>(ALL_TOPICS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    setSupport(pushSupport());
    const cfg = await getPushConfig();
    setServerReady(cfg.enabled);
    const sub = await currentSubscription();
    if (sub && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const st = await serverStatus(sub.endpoint);
      setOn(!!st?.subscribed);
      if (st?.subscribed) setTopicsState(st.topics);
    } else {
      setOn(false);
    }
    setChecked(true);
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function toggleMain(next: boolean) {
    if (!user) { setMsg("Sign in to manage notifications."); return; }
    setBusy(true); setMsg("");
    const res = next ? await enablePush(ALL_TOPICS) : await disablePush();
    if (!res.ok) setMsg(res.error ?? "Something went wrong.");
    else if (next) setTopicsState(ALL_TOPICS);
    await refresh();
    setBusy(false);
  }

  async function toggleTopic(t: PushTopicId, next: boolean) {
    const updated = next ? [...new Set([...topics, t])] : topics.filter((x) => x !== t);
    setTopicsState(updated); setBusy(true); setMsg("");
    const res = await setTopics(updated);
    if (!res.ok) { setMsg(res.error ?? "Could not save."); setTopicsState(topics); }
    setBusy(false);
  }

  const unavailable =
    support === "unsupported" ? "This browser can't show notifications."
    : support === "needs-install" ? "On iPhone, tap Share → Add to Home Screen, open Qubit from there, then come back to switch notifications on."
    : support === "blocked" ? "Notifications are blocked for Qubit. Allow them in your browser or phone settings (site settings → Notifications), then reload."
    : !serverReady && checked ? "Notifications aren't switched on for this app yet."
    : "";

  return (
    <div className="rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
      <div className="mb-4 flex items-center gap-2">
        {on ? <Bell className="h-5 w-5 text-violet-600" aria-hidden /> : <BellOff className="h-5 w-5 text-slate-400" aria-hidden />}
        <h2 className="text-xl font-black text-slate-900">Notifications</h2>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Phone notifications</p>
            <p className="text-xs text-slate-500">Get a notification on this phone, even when the app is closed</p>
          </div>
          <Switch on={on} onChange={(v) => void toggleMain(v)} label="Phone notifications" disabled={busy || !checked || !!unavailable} />
        </div>

        {on && ALL_TOPICS.map((t) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{LABEL[t].title}</p>
              <p className="text-xs text-slate-500">{LABEL[t].hint}</p>
            </div>
            <Switch on={topics.includes(t)} onChange={(v) => void toggleTopic(t, v)} label={LABEL[t].title} disabled={busy} />
          </div>
        ))}
      </div>

      {unavailable && <p className="mt-3 text-xs font-semibold text-amber-700">{unavailable}</p>}
      {msg && <p className="mt-3 text-xs font-semibold text-rose-600">{msg}</p>}
      <p className="mt-3 text-[11px] text-slate-400">This setting is for this phone only. You can turn it off any time.</p>
    </div>
  );
}
