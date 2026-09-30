"use client";

/**
 * Admin — Announcements. Broadcast a notification to every student profile.
 * Rows land in public.notifications and appear on /notifications.
 */

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminRole } from "@/lib/useAdminRole";
import { sendAnnouncement } from "@/lib/queries";
import { Megaphone, Send, Loader2 } from "lucide-react";

type SentItem = { title: string; body: string; at: string };

const HISTORY_KEY = "orbit_admin_announcements";

export default function AdminAnnouncementsPage() {
  const { user, isAdmin, loading: roleLoading } = useAdminRole();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<SentItem[]>([]);

  // Local history (notifications table has no "sender" column to filter by)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as SentItem[]);
    } catch { /* ignore */ }
  }, []);

  function remember(item: SentItem) {
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 3) {
      setNotice({ text: "Give the announcement a title and a message.", ok: false });
      return;
    }
    setSending(true);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const res = await sendAnnouncement(supabase, title.trim(), body.trim());
    if (res.ok) {
      remember({ title: title.trim(), body: body.trim(), at: new Date().toISOString() });
      setTitle(""); setBody("");
      setNotice({ text: "Announcement sent to all students.", ok: true });
    } else {
      setNotice({ text: res.error ?? "Could not send. Make sure the SQL migration has run and you are an admin.", ok: false });
    }
    setSending(false);
  }

  const quickPresets = [
    { title: "Mock exam week", body: "Full mock exams hold this week. Log in daily and complete at least one 180-question paper to track your readiness." },
    { title: "New syllabus uploaded", body: "Fresh syllabus breakdowns just landed in the Syllabus section. Check your subjects and plan the week." },
    { title: "Daily challenge reminder", body: "Keep your streak alive — the daily challenge resets at midnight." },
  ];

  if (!roleLoading && !isAdmin && user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
        <p className="text-base font-black text-white">Admins only</p>
        <p className="mt-2 text-sm text-slate-500">Your account does not have admin access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Comms</p>
        <h1 className="mt-1 text-2xl font-black text-white">Announcements</h1>
        <p className="mt-1 text-sm text-slate-500">Delivered to every student&apos;s notifications page instantly.</p>
      </header>

      <form onSubmit={handleSend} className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80}
            placeholder="e.g. Mock exam week starts Monday"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-violet-500" />
        </label>
        <label className="mt-4 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={500}
            placeholder="Write the announcement students will see in their notifications…"
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
        </label>
        <p className="mt-1 text-right text-[10px] text-slate-500">{body.length}/500</p>

        {/* Quick presets */}
        <div className="mt-2 flex flex-wrap gap-2">
          {quickPresets.map((p) => (
            <button key={p.title} type="button" onClick={() => { setTitle(p.title); setBody(p.body); }}
              className="rounded-full bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700">
              {p.title}
            </button>
          ))}
        </div>

        {notice && (
          <p className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${notice.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Megaphone className="h-4 w-4 text-violet-400" aria-hidden /> Goes to all {""}
            <span className="font-bold text-slate-400">profiles</span> via notifications
          </p>
          <button type="submit" disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
            {sending ? "Sending…" : "Send announcement"}
          </button>
        </div>
      </form>

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-black text-slate-400">Recent (this device)</h2>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="rounded-xl bg-slate-900 px-4 py-3 ring-1 ring-slate-800">
                <p className="text-sm font-bold text-white">{h.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{h.body}</p>
                <p className="mt-1 text-[10px] text-slate-600">{new Date(h.at).toLocaleString("en-NG")}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
