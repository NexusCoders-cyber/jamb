"use client";

/**
 * Per-subject syllabus page (/knowledge-hub/[subject]).
 * Shows the admin-uploaded syllabus entries for the subject — text topics and
 * file attachments (PDFs/images) — plus quick practice links.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSyllabusForSubject, type SyllabusItem } from "@/lib/queries";
import { ALOC_SUBJECTS, slugToName } from "@/lib/aloc";
import AppShell from "@/components/AppShell";
import { BookOpen, FileText, Loader2, PenLine } from "lucide-react";

export default function SubjectSyllabusPage() {
  const params = useParams<{ subject: string }>();
  const raw = typeof params?.subject === "string" ? params.subject : "";
  const subjectName = slugToName(decodeURIComponent(raw));

  const [items, setItems] = useState<SyllabusItem[] | null>(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!subjectName) return;
    const supabase = createSupabaseBrowserClient();
    getSyllabusForSubject(supabase, subjectName)
      .then((rows) => setItems(rows))
      .catch(() => { setItems([]); setLoadFailed(true); });
  }, [subjectName]);

  const meta = ALOC_SUBJECTS.find((s) => s.slug === raw || s.name === subjectName);

  return (
    <AppShell title={subjectName || "Syllabus"}>
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        <Link href="/knowledge-hub" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-violet-600">
          ← All subjects
        </Link>

        <header className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-violet-600 text-xl font-black text-white">
            {(subjectName || "?").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900">{subjectName || "Subject"}</h1>
            <p className="text-sm text-slate-400">Official UTME syllabus &amp; topics to cover</p>
          </div>
        </header>

        {/* Practice shortcuts */}
        <div className="mb-6 flex gap-2">
          <Link href={`/practice?subject=${encodeURIComponent(subjectName)}&mode=study`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-md shadow-violet-200">
            <BookOpen className="h-4 w-4" aria-hidden /> Study
          </Link>
          <Link href={`/practice?subject=${encodeURIComponent(subjectName)}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
            <PenLine className="h-4 w-4" aria-hidden /> Practice
          </Link>
        </div>

        {/* Syllabus content */}
        {items === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading syllabus…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] bg-slate-50 p-10 text-center ring-1 ring-slate-200">
            <FileText className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-3 text-base font-black text-slate-900">Syllabus coming soon</p>
            <p className="mt-1 text-sm text-slate-500">
              {loadFailed
                ? "Couldn't load right now — check your connection and refresh."
                : "The admin hasn't uploaded this subject's syllabus yet. Check back shortly."}
            </p>
            {meta && (
              <Link href={`/practice?subject=${encodeURIComponent(meta.name)}&mode=study`}
                className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white">
                Practice {meta.name} questions →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-[24px] bg-white p-5 ring-1 ring-slate-100 shadow-sm">
                <h2 className="text-base font-black text-slate-900">{item.title}</h2>
                {item.body && (
                  <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.body}</div>
                )}
                {item.file_url && (
                  <a href={item.file_url} target="_blank" rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700 ring-1 ring-violet-100 hover:bg-violet-100">
                    <FileText className="h-4 w-4" aria-hidden />
                    {item.file_name ?? "Download attachment"}
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
