"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { getNovel } from "@/lib/novels";
import { ArrowLeft, GraduationCap, Play, Users, Lightbulb, ListOrdered, BookOpen } from "lucide-react";

type Tab = "story" | "characters" | "themes" | "exam";

export default function NovelReaderPage() {
  const params = useParams<{ slug: string }>();
  const novel = getNovel(params.slug ?? "");
  const [tab, setTab] = useState<Tab>("story");

  if (!novel) {
    return (
      <AppShell title="Novel" back="/novels">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-xl font-black text-slate-900">Novel not found</p>
          <Link href="/novels" className="mt-4 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">
            All novels
          </Link>
        </div>
      </AppShell>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "story", label: "Story", icon: ListOrdered },
    { id: "characters", label: "Characters", icon: Users },
    { id: "themes", label: "Themes", icon: Lightbulb },
    { id: "exam", label: "Exam focus", icon: GraduationCap },
  ];

  return (
    <AppShell title={novel.title} back="/novels">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-3xl lg:px-6">
        {/* Back */}
        <div className="mb-4">
          <Link href="/novels" className="flex items-center gap-1.5 text-sm font-bold text-violet-600">
            <ArrowLeft className="h-4 w-4" aria-hidden /> All novels
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-[28px] bg-gradient-to-br from-amber-600 to-amber-500 p-6 text-white shadow-xl shadow-amber-300/25">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
            {novel.genre} · {novel.examBody}
          </p>
          <h1 className="mt-2 text-3xl font-black">{novel.title}</h1>
          <p className="text-sm font-semibold text-amber-100">by {novel.author}</p>
          <p className="mt-2 text-sm text-white/85">{novel.tagline}</p>
          <Link href={`/practice/novel`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-amber-700 hover:bg-amber-50">
            <Play className="h-4 w-4" aria-hidden /> Practise this novel
          </Link>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                  tab === t.id ? "bg-amber-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-amber-200"
                }`}>
                <Icon className="h-3.5 w-3.5" aria-hidden /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4">
          {tab === "story" && (
            <>
              <section className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                <h2 className="text-base font-black text-slate-900">About the book</h2>
                <p className="mt-2 text-sm leading-7 text-slate-700">{novel.about}</p>
                <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Setting</h3>
                <p className="mt-1 text-sm leading-7 text-slate-700">{novel.setting}</p>
              </section>
              <section className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
                <h2 className="mb-3 text-base font-black text-slate-900">Chapter-by-chapter</h2>
                <ol className="space-y-3">
                  {novel.chapters.map((ch, i) => (
                    <li key={ch.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                      <p className="text-sm font-black text-slate-900">{i + 1}. {ch.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{ch.summary}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}

          {tab === "characters" && (
            <section className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-3 text-base font-black text-slate-900">Who is who</h2>
              <div className="space-y-2">
                {novel.characters.map((c) => (
                  <div key={c.name} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <p className="text-sm font-black text-slate-900">{c.name}</p>
                    <p className="text-sm text-slate-600">{c.role}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "themes" && (
            <section className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-3 text-base font-black text-slate-900">Major themes</h2>
              <div className="space-y-2">
                {novel.themes.map((t) => (
                  <div key={t.title} className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
                    <p className="text-sm font-black text-amber-900">{t.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-amber-900/80">{t.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "exam" && (
            <section className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200">
              <h2 className="mb-3 text-base font-black text-slate-900">What JAMB-style questions test</h2>
              <ul className="space-y-2">
                {novel.examFocus.map((f) => (
                  <li key={f} className="flex gap-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-100">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={`/practice/novel`}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 text-sm font-black text-white hover:bg-amber-700">
                <Play className="h-4 w-4" aria-hidden /> Practise questions on this novel
              </Link>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
