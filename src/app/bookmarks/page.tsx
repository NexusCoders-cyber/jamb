"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, PlayCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import QuestionImage from "@/components/QuestionImage";
import { useUser } from "@/lib/useUser";
import { listLocalBookmarks, removeLocalBookmark, subscribeLocal, type LocalBookmark } from "@/lib/localDb";
import { startMistakeRedrill } from "@/lib/redrill";

const LETTERS = ["A", "B", "C", "D", "E"];

export default function BookmarksPage() {
  const { user, loading: authLoading } = useUser();
  const [items, setItems] = useState<LocalBookmark[] | null>(null);
  const [subject, setSubject] = useState("All");
  const [openAnswer, setOpenAnswer] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await listLocalBookmarks(user.id));
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return subscribeLocal(() => void load());
  }, [load]);

  const subjects = useMemo(() => ["All", ...Array.from(new Set((items ?? []).map((b) => b.subject))).sort()], [items]);
  const visible = (items ?? []).filter((b) => subject === "All" || b.subject === subject);

  async function practiseSaved() {
    if (!user || starting || visible.length === 0) return;
    setStarting(true);
    try {
      await startMistakeRedrill(user.id, visible.slice(0, 40).map((b) => b.question), "Saved questions");
      router.push("/exam?mode=practice&resume=1");
    } finally {
      setStarting(false);
    }
  }

  return (
    <AppShell title="Bookmarks">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Bookmark className="h-6 w-6 text-violet-600" aria-hidden /> Bookmarks
        </h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Questions you saved. They are kept on this device, work offline, and are included in your cloud backup.
        </p>

        <AuthGuard user={user} loading={authLoading}>
          {items === null ? (
            <div className="h-28 animate-pulse rounded-[24px] bg-slate-100" />
          ) : items.length === 0 ? (
            <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-slate-200">
              <p className="font-black text-slate-900">No bookmarks yet</p>
              <p className="mt-1 text-sm text-slate-500">Tap “Save” on a question during an exam or in your corrections to keep it here.</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void practiseSaved()}
                disabled={starting || visible.length === 0}
                className="mb-3 inline-flex h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-300/20 disabled:opacity-60"
              >
                <PlayCircle className="h-4 w-4" aria-hidden /> {starting ? "Preparing…" : `Practise these ${Math.min(visible.length, 40)} questions`}
              </button>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {subjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubject(s)}
                    className={`shrink-0 touch-manipulation rounded-full px-4 py-1.5 text-sm font-bold ${subject === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {visible.map((b) => {
                  const q = b.question;
                  const shown = openAnswer.has(b.key);
                  return (
                    <article key={b.key} className="rounded-[24px] bg-white p-4 ring-1 ring-slate-200 sm:p-5">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">{b.subject}</span>
                        <button
                          type="button"
                          onClick={() => user && void removeLocalBookmark(user.id, b.questionId)}
                          aria-label="Remove bookmark"
                          className="inline-flex touch-manipulation items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                        </button>
                      </div>
                      {q.section && <p className="mb-3 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm leading-6 text-slate-800">{q.section}</p>}
                      {(q.images ?? (q.image ? [q.image] : [])).map((src) => (
                        <div key={src} className="mb-3"><QuestionImage src={src} /></div>
                      ))}
                      <p className="whitespace-pre-line text-[15px] font-semibold leading-7 text-slate-900">{q.prompt}</p>
                      <ul className="mt-3 space-y-2">
                        {q.options.map((opt, i) => {
                          const correct = shown && i === q.correct_option;
                          return (
                            <li key={i} className={`flex gap-3 rounded-xl px-3 py-2 text-sm ring-1 ${correct ? "bg-emerald-50 text-emerald-900 ring-emerald-300" : "bg-slate-50 text-slate-800 ring-slate-200"}`}>
                              <span className="font-black">{LETTERS[i] ?? i + 1}.</span>
                              <span className="min-w-0 break-words">{opt}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        type="button"
                        onClick={() => setOpenAnswer((p) => { const n = new Set(p); if (n.has(b.key)) n.delete(b.key); else n.add(b.key); return n; })}
                        className="mt-3 h-10 touch-manipulation rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
                      >
                        {shown ? "Hide answer" : "Show answer"}
                      </button>
                      {shown && q.explanation && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{q.explanation}</p>}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </AuthGuard>
      </div>
    </AppShell>
  );
}
