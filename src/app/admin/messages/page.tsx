"use client";

/**
 * Admin — Messages. Compose once, deliver anywhere: bulk email through
 * Resend and/or in-app notifications. Audience = everyone, students,
 * admins, hand-picked users, or pasted email addresses.
 */

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Bell, Loader2, Mail, Send } from "lucide-react";

type UserRow = { id: string; full_name: string; email: string | null; role: "student" | "admin" };

type Audience = "all" | "students" | "admins" | "selected" | "pasted";

export default function AdminMessagesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasted, setPasted] = useState("");
  const [viaEmail, setViaEmail] = useState(true);
  const [viaInApp, setViaInApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => { setUsers((data ?? []) as UserRow[]); setLoading(false); });
  }, []);

  const pastedEmails = pasted.split(/[,\s;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));

  const recipients = useCallback((): Array<{ id: string; email: string | null }> => {
    switch (audience) {
      case "all": return users;
      case "students": return users.filter((u) => u.role === "student");
      case "admins": return users.filter((u) => u.role === "admin");
      case "selected": return users.filter((u) => selected.has(u.id));
      case "pasted":
        return pastedEmails.map((email) => ({ id: email, email }));
    }
  }, [audience, users, selected, pastedEmails]);

  const recipientCount = recipients().length;

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setNotice({ text: "Subject and message are required.", ok: false });
      return;
    }
    if (recipientCount === 0) {
      setNotice({ text: "Pick an audience with at least one recipient.", ok: false });
      return;
    }
    if (!viaEmail && !viaInApp) {
      setNotice({ text: "Choose at least one channel (email or in-app).", ok: false });
      return;
    }
    if (!window.confirm(`Send to ${recipientCount} recipient(s)${viaEmail ? " by email" : ""}${viaEmail && viaInApp ? " +" : ""}${viaInApp ? " in-app" : ""}?`)) return;

    setSending(true);
    setNotice(null);
    const targets = recipients();

    try {
      const parts: string[] = [];

      if (viaEmail) {
        const emails = targets.map((t) => t.email).filter((e): e is string => Boolean(e));
        if (emails.length === 0) throw new Error("No valid email addresses in this audience.");
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
          body: JSON.stringify({ emails, subject, body }),
        });
        const json = (await res.json()) as { sent?: number; failed?: number; errors?: string[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Email sending failed");
        parts.push(`${json.sent ?? 0} emails sent${json.failed ? `, ${json.failed} failed` : ""}`);
      }

      if (viaInApp) {
        const supabase = createSupabaseBrowserClient();
        const rows = targets
          .filter((t) => t.id.includes("-")) // pasted emails have no user id
          .map((t) => ({ user_id: t.id, title: subject.trim(), body: body.trim() }));
        if (rows.length > 0) {
          const { error } = await supabase.from("notifications").insert(rows);
          if (error) throw new Error(error.message);
          parts.push(`${rows.length} in-app notifications`);
        }
      }

      setNotice({ text: `Delivered: ${parts.join(" · ")}.`, ok: true });
      setSubject(""); setBody(""); setPasted(""); setSelected(new Set());
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : "Send failed", ok: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Communication</p>
        <h1 className="mt-1 text-2xl font-black text-white">Send messages</h1>
      </header>

      {notice && (
        <div className={`mb-4 rounded-2xl px-4 py-3 text-sm font-semibold ${
          notice.ok ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30" : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30"
        }`}>
          {notice.text}
        </div>
      )}

      {/* Audience */}
      <section className="mb-4 rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <p className="text-sm font-black text-white">Audience</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ["all", `Everyone (${users.length})`],
            ["students", `Students (${users.filter((u) => u.role === "student").length})`],
            ["admins", `Admins (${users.filter((u) => u.role === "admin").length})`],
            ["selected", `Picked (${selected.size})`],
            ["pasted", "Pasted emails"],
          ] as Array<[Audience, string]>).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setAudience(value)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${audience === value ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {audience === "selected" && (
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-2xl bg-slate-800/60 p-3">
            {loading && <p className="text-xs text-slate-400">Loading users…</p>}
            {users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50">
                <input type="checkbox" checked={selected.has(u.id)}
                  onChange={(e) => setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(u.id); else next.delete(u.id);
                    return next;
                  })}
                  className="h-4 w-4 accent-violet-500" />
                <span className="min-w-0 flex-1 truncate">{u.full_name || "(no name)"} <span className="text-slate-500">{u.email}</span></span>
              </label>
            ))}
          </div>
        )}

        {audience === "pasted" && (
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3}
            placeholder="Paste email addresses, separated by commas or new lines…"
            className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
        )}
      </section>

      {/* Compose */}
      <section className="mb-4 rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <p className="text-sm font-black text-white">Message</p>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
          className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2.5 text-sm font-bold text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={5000}
          placeholder="Write your message… (sent as-is by email and in-app)"
          className="mt-2 w-full resize-none rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />

        {/* Channels */}
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 ring-1 ring-slate-700">
            <input type="checkbox" checked={viaEmail} onChange={(e) => setViaEmail(e.target.checked)} className="h-4 w-4 accent-violet-500" />
            <Mail className="h-3.5 w-3.5" aria-hidden /> Email (Resend)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 ring-1 ring-slate-700">
            <input type="checkbox" checked={viaInApp} onChange={(e) => setViaInApp(e.target.checked)} className="h-4 w-4 accent-violet-500" />
            <Bell className="h-3.5 w-3.5" aria-hidden /> In-app notification
          </label>
        </div>
      </section>

      <button type="button" onClick={() => void send()} disabled={sending}
        className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-700 disabled:opacity-50">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
        {sending ? "Sending…" : `Send to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
