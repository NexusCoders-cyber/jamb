"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthGuard from "@/components/AuthGuard";
import {
  getDMThread, sendDM, markDMsRead, getProfile, deleteDM,
  type DirectMessage,
} from "@/lib/queries";
import Avatar from "@/components/Avatar";
import EmojiPicker from "@/components/EmojiPicker";
import { Mail, Reply, Copy, Trash2, X } from "lucide-react";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString();
  if (d.toDateString() === today) return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Long-press detection (touch + mouse; right-click opens it on desktop) ───

// Plain handler factory — deliberately NOT a hook, so it can be used inside
// .map() loops. Timer state lives in module-level maps keyed by message id,
// so a re-render between press and release can never orphan a timer.
const pressTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pressFired = new Set<string>();

function longPressHandlers(id: string, onLongPress: () => void, ms = 450) {
  function clear() {
    const t = pressTimers.get(id);
    if (t) { clearTimeout(t); pressTimers.delete(id); }
  }
  function start() {
    clear();
    pressFired.delete(id);
    pressTimers.set(id, setTimeout(() => {
      pressTimers.delete(id);
      pressFired.add(id);
      onLongPress();
    }, ms));
  }
  // After a long-press fires, swallow the click that follows so the sheet
  // doesn't close instantly from the release tap.
  function onClickCapture(e: React.MouseEvent) {
    if (pressFired.has(id)) {
      e.preventDefault();
      e.stopPropagation();
      pressFired.delete(id);
    }
  }

  return {
    onTouchStart: start,
    onMouseDown: start,
    onTouchEnd: clear,
    onTouchMove: clear, // finger scrolled away — cancel
    onMouseUp: clear,
    onMouseLeave: clear,
    onClickCapture,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onLongPress(); },
  };
}

// ─── Bottom action sheet (WhatsApp style) ─────────────────────────────────────

function MessageActionSheet({
  msg, isMine, partnerName, onReply, onCopy, onDelete, onClose,
}: {
  msg: DirectMessage;
  isMine: boolean;
  partnerName: string;
  onReply: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Message actions">
      {/* Dim + blur backdrop — tap to dismiss */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 animate-pop-in">
        <div className="mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-slate-200">
            {/* Message preview */}
            <div className="px-4 py-3 text-center">
              <p className="truncate text-xs font-semibold text-slate-400">
                {isMine ? "Your message" : `From ${partnerName}`}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-700">{msg.body}</p>
            </div>
            <div className="h-px bg-slate-100" />

            {/* Actions */}
            <button type="button" onClick={onReply}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-bold text-slate-800 hover:bg-violet-50">
              <Reply className="h-5 w-5 text-violet-600" aria-hidden /> Reply
            </button>
            <div className="h-px bg-slate-100" />
            <button type="button" onClick={onCopy}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-bold text-slate-800 hover:bg-violet-50">
              <Copy className="h-5 w-5 text-violet-600" aria-hidden /> Copy text
            </button>
            {isMine && (
              <>
                <div className="h-px bg-slate-100" />
                <button type="button" onClick={onDelete}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-5 w-5" aria-hidden /> Delete message
                </button>
              </>
            )}
          </div>

          <button type="button" onClick={onClose}
            className="mt-2 w-full rounded-[24px] bg-white/95 py-3.5 text-sm font-black text-slate-600 shadow-xl ring-1 ring-slate-200 hover:bg-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DMConversationPage() {
  const { userId: partnerId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useUser();

  const [partnerName, setPartnerName] = useState("Student");
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [sheetMsg, setSheetMsg] = useState<DirectMessage | null>(null);
  const [copied, setCopied] = useState(false);
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
      if (profile) {
        setPartnerName(profile.full_name || "Student");
        setPartnerAvatar(profile.avatar_url || null);
      }
      setMessages(dms);
      markDMsRead(supabase, user.id, partnerId);
    }).finally(() => { setLoading(false); setTimeout(() => bottomRef.current?.scrollIntoView(), 50); });
  }, [user, partnerId, authLoading]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partnerId) return;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch (_e) { return; }

    // Unique suffix per mount — a fixed channel name can be returned already
    // subscribed on StrictMode/Fast Refresh remounts, and re-adding .on()
    // callbacks then throws (supabase-js RealtimeClient contract).
    const channel = supabase
      .channel(`dm-${[user.id, partnerId].sort().join("-")}-${Math.random().toString(36).slice(2)}`)
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
    const msg = await sendDM(supabase, user.id, partnerId, body.trim(), replyTo?.id ?? null);
    if (msg) {
      setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setBody("");
      setReplyTo(null);
      setTimeout(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); }, 80);
    } else {
      setSendError("Could not send message. Try again.");
    }
    setSending(false);
  }

  async function handleDelete(msg: DirectMessage) {
    if (!user || !window.confirm("Delete this message?")) return;
    setSendError("");
    const supabase = createSupabaseBrowserClient();
    const ok = await deleteDM(supabase, msg.id);
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (replyTo?.id === msg.id) setReplyTo(null);
    } else {
      setSendError("Could not delete — the update may not be applied yet.");
    }
  }

  async function handleCopy(msg: DirectMessage) {
    try {
      await navigator.clipboard.writeText(msg.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable (e.g. insecure context) */ }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleSend(); }
  }

  // Resolve a reply quote: realtime inserts carry no join, so fall back to
  // looking up the referenced message among the ones already in the thread.
  function replySource(msg: DirectMessage): { body: string; senderName: string } | null {
    const target = msg.reply_to ?? messages.find((m) => m.id === msg.reply_to_id);
    if (!target) return null;
    const name = target.sender_id === user?.id ? myName : partnerName;
    return { body: target.body, senderName: name };
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

  if (authLoading || !user) {
    return (
      <AuthGuard user={user} loading={authLoading}>
        <></>
      </AuthGuard>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-[#eef2ff]">
      {/* Top bar — sticky: never scrolls away (WhatsApp style) */}
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Link href="/messages" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
          ←
        </Link>
        {/* Tap avatar or name to view the partner's profile (Facebook-style) */}
        <Link href={`/profile/${partnerId}`} className="shrink-0" aria-label={`View ${partnerName}'s profile`}>
          <Avatar user={{ full_name: partnerName, avatar_url: partnerAvatar }} />
        </Link>
        <Link href={`/profile/${partnerId}`} className="flex-1 min-w-0">
          <p className="font-black text-slate-900 truncate">{partnerName}</p>
          <p className="text-xs text-slate-400">View profile</p>
        </Link>
        <Link href="/community" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Community
        </Link>
      </header>

      {/* Messages area — the only scrollable region */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
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
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
                <Mail className="h-8 w-8 text-violet-600" aria-hidden />
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
                    const quote = replySource(msg);
                    const longPress = longPressHandlers(msg.id, () => setSheetMsg(msg));
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        {!isMe && partnerName && (
                          <Link href={`/profile/${partnerId}`} className="shrink-0" aria-label={`View ${partnerName}'s profile`}>
                            <Avatar user={{ full_name: partnerName, avatar_url: partnerAvatar }} size="sm" />
                          </Link>
                        )}
                        <div
                          {...longPress}
                          className="max-w-[75%] cursor-pointer select-none no-callout active:opacity-90"
                          title="Long-press for actions"
                        >
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            isMe
                              ? "rounded-br-sm bg-violet-600 text-white"
                              : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200"
                          }`}>
                            {/* Reply quote */}
                            {quote && (
                              <div className={`mb-1.5 rounded-lg border-l-[3px] px-2 py-1 text-xs ${
                                isMe ? "border-[#f6c978] bg-black/10 text-violet-100" : "border-violet-400 bg-violet-50 text-slate-500"
                              }`}>
                                <p className="font-bold">{quote.senderName}</p>
                                <p className="line-clamp-2">{quote.body}</p>
                              </div>
                            )}
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

      {/* Input bar — sticky: always pinned to the bottom (WhatsApp style) */}
      <div className="sticky bottom-0 z-30 shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-2xl">
          {sendError && <p className="mb-2 text-xs text-rose-600">{sendError}</p>}

          {/* Reply-to preview */}
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-violet-500 bg-violet-50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-violet-700">
                  Replying to {replyTo.sender_id === user?.id ? "yourself" : partnerName}
                </p>
                <p className="truncate text-xs text-slate-500">{replyTo.body}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          <div className="flex items-end gap-3">
            <Avatar user={{ full_name: myName, avatar_url: null }} size="sm" />
          <div className="flex items-end gap-1">
            <EmojiPicker onPick={(emoji) => setBody((b) => b + emoji)} />
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

      {/* Long-press action sheet */}
      {sheetMsg && (
        <MessageActionSheet
          msg={sheetMsg}
          isMine={sheetMsg.sender_id === user.id}
          partnerName={partnerName}
          onReply={() => { setReplyTo(sheetMsg); setSheetMsg(null); setTimeout(() => inputRef.current?.focus(), 60); }}
          onCopy={() => { void handleCopy(sheetMsg); setSheetMsg(null); }}
          onDelete={() => { void handleDelete(sheetMsg); setSheetMsg(null); }}
          onClose={() => setSheetMsg(null)}
        />
      )}

      {/* Copied toast */}
      {copied && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[60] -translate-x-1/2 animate-pop-in rounded-full bg-slate-900/90 px-4 py-2 text-xs font-bold text-white shadow-xl">
          Copied to clipboard
        </div>
      )}
    </main>
  );
}
