"use client";

/**
 * EmojiPicker — compact popover for composers (DMs, replies, posts).
 * No emoji in the surrounding UI chrome — only in the palette itself.
 */

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: ["😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🤩", "😘", "😗", "😚", "😋", "😛", "🤔", "🤨", "😐", "😑", "🙄", "😏", "😴", "😔", "😕", "🙃", "🥲", "🥰", "😎", "🤓", "🧐"],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤝", "🙏", "💪", "👏", "🙌", "🫡", "🫶", "✍️", "🤙", "👊", "✊"],
  },
  {
    label: "Study",
    emojis: ["📚", "📖", "📝", "✏️", "🖊️", "📌", "📎", "🔍", "💡", "🎯", "🏆", "⏰", "📅", "✅", "❌", "⭐", "🔥", "💯", "🧠", "🎓", "📐", "📊", "🔬", "🧪"],
  },
  {
    label: "Feelings",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✨", "🎉", "🎊", " 😅", "🥳", "😌", "🤗", "😭", "😢", "😤", "😱", "🤯", "🥺", "😏", "😬"],
  },
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert emoji"
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
      >
        <Smile className="h-6 w-6" aria-hidden />
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex gap-1">
            {GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setTab(i)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition ${
                  tab === i ? "bg-violet-100 text-violet-700" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-7 gap-1 overflow-y-auto">
            {GROUPS[tab].emojis.map((e, i) => (
              <button
                key={`${e}-${i}`}
                type="button"
                onClick={() => { onPick(e.trim()); }}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition hover:bg-violet-50 active:bg-violet-100"
                aria-label={`Insert ${e.trim()}`}
              >
                {e.trim()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
