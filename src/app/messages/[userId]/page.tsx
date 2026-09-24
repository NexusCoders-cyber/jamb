"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getDMThread, sendDM, markDMsRead, getProfile,
  type DirectMessage,
} from "@/lib/queries";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString();
  if (d.toDateString() === today) return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700 ${sz}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function DMConversationPage() {
  const { userId: partnerId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useUser();

  const [partnerName, setPartnerName] = useState("Student");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load partner name + message history
  useEffect(() => {
    if (authLoading || !user || !partnerId) return;
    const supabase = createSupabaseBrowserClient();

    Promise.all([
      getProfile(supabase, partnerId),
      getDMThread(supabase, user.id, partnerId),
    ]).then(([profile, dms]) => {
      if (profile) setPartnerName(profile.full_name || "Student");
      setMessages(dms);
      markDMsRead(supabase, user.id, partnerId);
    }).finally(() => { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView(), 50); });
  }, [user, partnerId, authLoading]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { return; }

    const channel = supabase
      .channel(`dm-${[user.id, partnerId].sort().join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const msg = payload.new as DirectMessage;
          const relevant =
            (msg.sender_id === user.id && msg.receiver_id === partnerId) ||
            (msg.sender_id === partnerId && msg.receiver_id === user.id);
          if (!relevant) return;

          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id === partnerId) {
            supabase.from("direct_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", msg.id);
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  async function handleSend() {
    if (!user || !partnerId || body.trim().length === 0) return;
    setSending(true); setSendError("");
    const supabase = createSupabaseBrowserClient();
    const msg = await sendDM(supabase, user.id, partnerId, body.trim());
    if (msg) {
      setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setBody("");
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); }, 80);
    } else {
      setSendError("Could not send message. Try again.");
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleSend(); }
  }

  // Group messages by date
  type MsgGroup = { dateLabel: string; messages: DirectMessage[] };
  const grouped: MsgGroup[] = [];
  for (const msg of messages) {
    const label = new Date(msg.created_at).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
    const last = grouped[grouped.length - 1];
    if (last?.dateLabel === label) last.messages.push(msg);
    else grouped.push({ dateLabel: label, messages: [msg] });
  }

  const myName = (user?.user_metadata?.full_name as string | undefined) ?? "You";

  if (!user && !authLoading) {
    return (
      <main className="min-h-screen bg-[#eef2ff] px-4 py-8 flex items-center justify-center">
        <div className="rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="font-bold text-slate-700">Sign in to view messages</p>
          <Link href="/" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#eef2ff]">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link href="/messages" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
          ←
        </Link>
        <Avatar name={partnerName} />
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 truncate">{partnerName}</p>
          <p className="text-xs text-slate-400">Student</p>
        </div>
        <Link href="/community" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Community
        </Link>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {loading ? (
            <div className="space-y-3 pt-8">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`flex ${n % 2 === 0 ? "justify-end" : ""}`}>
                  <div className="animate-pulse rounded-2xl bg-slate-200 h-10 w-48" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="pt-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl">
                ✉
              </div>
              <p className="text-lg font-black text-slate-900">Start the conversation</p>
              <p className="mt-1 text-sm text-slate-500">Send {partnerName} a message below.</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.dateLabel}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-500">{group.dateLabel}</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <div className="space-y-2">
                  {group.messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const senderName = isMe ? myName : partnerName;
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        {!isMe && <Avatar name={senderName} size="sm" />}
                        <div className={`max-w-[75%] group`}>
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            isMe
                              ? "rounded-br-sm bg-violet-600 text-white"
                              : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200"
                          }`}>
                            {msg.body}
                          </div>
                          <p className={`mt-0.5 text-[10px] text-slate-400 ${isMe ? "text-right" : ""}`}>
                            {timeLabel(msg.created_at)}
                            {isMe && msg.read_at && " · Read"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {sendError && <p className="mb-2 text-xs text-rose-600">{sendError}</p>}
          <div className="flex items-end gap-3">
            <Avatar name={myName} size="sm" />
            <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-violet-400 transition">
              <textarea
                ref={inputRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${partnerName}…`}
                rows={1}
                maxLength={2000}
                className="block w-full resize-none bg-transparent px-4 py-3 text-sm outline-none max-h-32"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || body.trim().length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md transition hover:bg-violet-700 disabled:opacity-40"
              aria-label="Send message"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 rotate-90">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
          <p className="mt-1 text-right text-[10px] text-slate-400">Ctrl+Enter to send</p>
        </div>
      </div>
    </main>
  );
}
