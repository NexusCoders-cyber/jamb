"use client";

import Link from "next/link";
import { Check, Clock, Swords, Trophy, X } from "lucide-react";
import ExplanationView from "@/components/ExplanationView";
import type { MatchState } from "./types";

const letter = (i: number) => String.fromCharCode(65 + i);

export default function ResultScreen({
  match, myId, onExit, onRematch,
}: { match: MatchState; myId: string; onExit: () => void; onRematch?: () => void }) {
  const won = match.winnerId === myId;
  const tie = match.winnerId === null;
  const oppLabel = (match.oppName ?? "Opponent").split(" ")[0];

  return (
    <div className="space-y-4">
      <div className={`rounded-[28px] p-6 text-center text-white ${won ? "bg-gradient-to-br from-emerald-700 to-emerald-500" : tie ? "bg-gradient-to-br from-slate-700 to-slate-500" : "bg-gradient-to-br from-rose-700 to-rose-500"}`}>
        <Trophy className="mx-auto h-10 w-10" aria-hidden />
        <h2 className="mt-3 text-3xl font-black">
          {match.isDuel ? (won ? "You win! 🏆" : tie ? "It's a draw" : "So close!") : "Drill complete!"}
        </h2>

        <div className="mx-auto mt-4 grid max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-2" aria-label={`Final score ${match.yourScore} to ${match.oppScore}`}>
          <div className={`rounded-2xl px-2 py-3 ring-1 ${won ? "bg-white/25 ring-white/50" : "bg-black/15 ring-white/15"}`}>
            <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/80">You</p>
            <p className="text-4xl font-black tabular-nums leading-none">{match.yourScore}</p>
            {match.total > 0 && <p className="mt-1 text-[11px] font-semibold text-white/75">of {match.total}</p>}
          </div>
          <span className="text-sm font-black text-white/70">{match.isDuel ? "vs" : ""}</span>
          {match.isDuel ? (
            <div className={`rounded-2xl px-2 py-3 ring-1 ${!won && !tie ? "bg-white/25 ring-white/50" : "bg-black/15 ring-white/15"}`}>
              <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/80">{oppLabel}</p>
              <p className="text-4xl font-black tabular-nums leading-none">{match.oppScore}</p>
              {match.total > 0 && <p className="mt-1 text-[11px] font-semibold text-white/75">of {match.total}</p>}
            </div>
          ) : <span />}
        </div>

        <p className="mt-3 text-sm opacity-90">Final score {match.yourScore} – {match.oppScore} · {match.subject}</p>
        <p className="mt-3 text-xs opacity-80">
          {match.isDuel && !tie
            ? won
              ? "Win bonus + points added — check the leaderboard."
              : "QPoints settled by the result — win next time for the 25-point bonus."
            : "QPoints have been added to your ledger — check the leaderboard."}
        </p>

        <div className={`mt-5 grid gap-3 ${onRematch ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
          {onRematch && (
            <button type="button" onClick={onRematch}
              style={{ backgroundColor: "#ffffff", color: "#1e293b" }}
              className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-full px-5 text-sm font-black active:scale-[0.98]">
              <Swords className="h-4 w-4" aria-hidden /> Rematch {oppLabel}
            </button>
          )}
          <button type="button" onClick={onExit}
            className="flex min-h-12 touch-manipulation items-center justify-center rounded-full border border-white/30 px-5 text-sm font-bold text-white hover:bg-white/10 active:bg-white/10">
            New duel
          </button>
          <Link href="/leaderboard" className="flex min-h-12 touch-manipulation items-center justify-center rounded-full border border-white/30 px-5 text-sm font-bold text-white hover:bg-white/10 active:bg-white/10">
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Answer review — right answers, explanations and what each player picked */}
      {match.review && match.review.length > 0 && (
        <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Review answers</p>
          <div className="space-y-2.5">
            {match.review.map((r, i) => {
              const right = r.you === r.answer;
              const none = r.you !== null && r.you < 0;
              return (
                <details key={r.id ?? i} className="group rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
                      r.you === null ? "bg-slate-400" : right ? "bg-emerald-500" : none ? "bg-slate-400" : "bg-rose-500"
                    }`}>
                      {r.you === null ? i + 1 : right ? <Check className="h-4 w-4" aria-hidden /> : none ? <Clock className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{i + 1}. {r.prompt}</span>
                  </summary>
                  <div className="space-y-2 border-t border-slate-200 p-3.5">
                    <p className="text-sm font-semibold leading-6 text-slate-800">{r.prompt}</p>
                    {r.options.map((opt, oi) => (
                      <div key={oi} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold ${
                        oi === r.answer ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : r.you === oi ? "border-rose-300 bg-rose-50 text-rose-800"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}>
                        <span className="font-black">{letter(oi)}</span>
                        <span className="min-w-0 flex-1 break-words">{opt}</span>
                        {r.you === oi && <span className="shrink-0 text-[10px] font-black uppercase">You</span>}
                        {match.isDuel && r.opp === oi && <span className="shrink-0 text-[10px] font-black uppercase">{oppLabel}</span>}
                      </div>
                    ))}
                    {r.explanation && (
                      <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Explanation</p>
                        <ExplanationView text={r.explanation} subject={match.subject} className="mt-1.5" />
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
