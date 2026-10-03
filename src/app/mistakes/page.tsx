"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AppShell from "@/components/AppShell";
import { PaywallGate } from "@/components/Paywall";
import { getWrongAnswers } from "@/lib/queries";
import RichText from "@/components/RichText";
import QuestionImage from "@/components/QuestionImage";
import ExplanationView from "@/components/ExplanationView";
import { Check, PartyPopper, XCircle } from "lucide-react";
import type { AttemptAnswer } from "@/lib/queries";

type GroupedMistake = {
  subject: string;
  topics: { name: string; count: number; answers: AttemptAnswer[] }[];
};

function groupBySubject(answers: AttemptAnswer[]): GroupedMistake[] {
  const map = new Map<string, Map<string, AttemptAnswer[]>>();

  for (const a of answers) {
    const q = a.question as (typeof a.question & { subject?: { name: string } }) | undefined;
    const subjectName = q?.subject_name ?? q?.subject?.name ?? "Unknown";
    // Use first 30 chars of prompt as a rough "topic"
    const topic = q?.prompt?.slice(0, 35) ?? "Question";

    if (!map.has(subjectName)) map.set(subjectName, new Map());
    const topicMap = map.get(subjectName)!;
    if (!topicMap.has(topic)) topicMap.set(topic, []);
    topicMap.get(topic)!.push(a);
  }

  return Array.from(map.entries()).map(([subject, topicMap]) => ({
    subject,
    topics: Array.from(topicMap.entries())
      .map(([name, ansList]) => ({ name, count: ansList.length, answers: ansList }))
      .sort((a, b) => b.count - a.count),
  }));
}

export default function MistakesPage() {
  const { user, loading: authLoading } = useUser();

  const [groups, setGroups] = useState<GroupedMistake[]>([]);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttemptAnswer | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }

    const supabase = createSupabaseBrowserClient();
    getWrongAnswers(supabase, user.id, 60)
      .then((answers) => {
        setTotalMistakes(answers.length);
        setGroups(groupBySubject(answers));
        setSelected(answers[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const q = selected?.question;

  return (
    <PaywallGate feature="Mistakes">
    <AppShell title="Mistakes">
      <div className="mx-auto max-w-2xl px-4 py-4 lg:max-w-4xl lg:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900">Mistakes</h1>
          <Link href="/practice" className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white">Practice</Link>
        </div>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((n) => (
              <div key={n} className="animate-pulse rounded-[28px] bg-slate-100 p-5 h-48" />
            ))}
          </div>
        ) : totalMistakes === 0 ? (
          <div className="rounded-[24px] bg-slate-50 p-8 text-center ring-1 ring-slate-200">
            <p className="inline-flex items-center gap-2 text-2xl font-black text-slate-900">
              Clean slate <PartyPopper className="h-6 w-6 text-violet-600" aria-hidden />
            </p>
            <p className="mt-2 text-sm text-slate-500">No mistakes recorded yet. Complete exams to build your mistake bank.</p>
            <Link href="/exam" className="mt-5 inline-block rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">Take an exam</Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            {/* Grouped list */}
            <div className="space-y-6 overflow-y-auto" style={{ maxHeight: "640px" }}>
              <p className="text-sm text-slate-500">{totalMistakes} mistake{totalMistakes !== 1 ? "s" : ""} across your exams</p>
              {groups.map((section) => (
                <div key={section.subject} className="rounded-[28px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <h2 className="mb-4 text-2xl font-black text-slate-900">{section.subject}</h2>
                  <div className="space-y-3">
                    {section.topics.map((topic) => (
                      <button
                        key={topic.name}
                        type="button"
                        onClick={() => setSelected(topic.answers[0])}
                        className={`flex w-full items-center justify-between rounded-2xl p-3 ring-1 text-left transition ${selected?.id === topic.answers[0]?.id ? "ring-violet-400 bg-violet-50" : "bg-white ring-slate-200 hover:ring-violet-200"}`}
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{topic.name}…</p>
                          <p className="text-xs text-slate-500">Repeated errors</p>
                        </div>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                          {topic.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Question detail */}
            <div className="rounded-[28px] bg-slate-50 p-6 ring-1 ring-slate-200">
              {selected && q ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold text-rose-600">Wrong answer</p>
                    <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">Mistake</span>
                  </div>
                  <div className="rounded-[20px] bg-white p-5 ring-1 ring-slate-200">
                    {q.section && (
                      <div className={`mb-4 max-h-56 overflow-y-auto whitespace-pre-line rounded-2xl p-3 ring-1 ${
                        q.section_kind === "passage" ? "bg-amber-50 ring-amber-100" : "bg-slate-50 ring-slate-200"
                      }`}>
                        <p className={`mb-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                          q.section_kind === "passage" ? "text-amber-700" : "text-slate-400"
                        }`}>{q.section_kind === "passage" ? "Passage" : "Instruction"}</p>
                        <p className="text-sm leading-6 text-slate-700">{q.section}</p>
                      </div>
                    )}
                    {(q.images?.length ? q.images : q.image ? [q.image] : []).length > 0 && (
                      <div className="mb-4 grid gap-3">
                        {(q.images?.length ? q.images : q.image ? [q.image] : []).map((src) => (
                          <QuestionImage key={src} src={src} />
                        ))}
                      </div>
                    )}
                    <p className="text-lg leading-8 text-slate-800">
                      <RichText segments={q.prompt_segments} fallback={q.prompt} />
                    </p>
                    <div className="mt-5 space-y-3 text-sm">
                      {(q.options as string[]).map((opt, idx) => {
                        const isCorrect = idx === q.correct_option;
                        const isSelected = idx === selected.selected_option;
                        return (
                          <div
                            key={opt}
                            className={`rounded-2xl border p-3 ${
                              isCorrect
                                ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-900"
                                : isSelected
                                  ? "border-rose-300 bg-rose-50 text-rose-800"
                                  : "border-slate-200 text-slate-700"
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}. <RichText segments={q.option_segments?.[idx]} fallback={opt} />
                            {q.option_images?.[idx] && (
                              <QuestionImage key={q.option_images[idx] as string} src={q.option_images[idx] as string} zoomable={false} compact className="mt-2" />
                            )}
                            {isCorrect && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                <Check className="h-3.5 w-3.5" aria-hidden /> Correct
                              </span>
                            )}
                            {isSelected && !isCorrect && (
                              <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                                <XCircle className="h-3.5 w-3.5" aria-hidden /> Your answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div className="mt-5 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                        <p className="text-sm font-bold text-emerald-800">Explanation</p>
                        <ExplanationView text={q.explanation} subject={q.subject_name} className="mt-2.5" />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Select a mistake on the left to review it.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
    </PaywallGate>
  );
}
