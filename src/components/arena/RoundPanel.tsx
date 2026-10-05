"use client";

import { Check, Timer, X, Clock } from "lucide-react";
import type { MatchState } from "./types";

type Props = {
  match: MatchState;
  /** Server-corrected "now" in epoch ms. */
  nowMs: number;
  /** Option tapped this round before the server confirmed it. */
  localPick: number | null;
  busy: boolean;
  onAnswer: (choice: number) => void;
  onSkip: () => void;
};

const letter = (i: number) => String.fromCharCode(65 + i);

function firstName(name: string | null) {
  return name ? name.split(" ")[0] : "Opponent";
}

function Outcome({ who, pick, answer }: { who: string; pick: number | null; answer: number }) {
  if (pick === null) return null;
  const right = pick === answer;
  const none = pick < 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
      right ? "bg-emerald-100 text-emerald-700" : none ? "bg-slate-100 text-slate-500" : "bg-rose-100 text-rose-700"
    }`}>
      {right ? <Check className="h-3.5 w-3.5" aria-hidden /> : none ? <Clock className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
      {who} · {right ? "Correct" : none ? "No answer" : "Wrong"}
    </span>
  );
}

export default function RoundPanel({ match, nowMs, localPick, busy, onAnswer, onSkip }: Props) {
  const startsAt = match.roundStartsAt ? Date.parse(match.roundStartsAt) : 0;
  const endsAt = match.turnEndsAt ? Date.parse(match.turnEndsAt) : 0;
  const startsIn = Math.max(0, Math.ceil((startsAt - nowMs) / 1000));
  const secondsLeft = Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
  const fraction = Math.min(1, Math.max(0, (endsAt - nowMs) / ((match.roundSeconds || 25) * 1000)));
  const opp = firstName(match.oppName);

  // ── Between questions: get-ready countdown, or the reveal of the last one ──
  if (startsIn > 0) {
    const last = match.lastRound;
    if (!last) {
      return (
        <div className="rounded-[28px] bg-gradient-to-br from-[#41348f] to-[#6557d9] p-8 text-center text-white shadow-xl shadow-violet-300/25">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Duel starts</p>
          <p className="mt-3 text-7xl font-black tabular-nums" aria-live="polite">{startsIn}</p>
          <p className="mt-4 text-lg font-black">Get ready!</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-violet-100">
            {match.total} questions · {match.roundSeconds} seconds each. You and {opp} see every question at the same time.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Question {last.index + 1} result</p>
          <p className="text-xs font-black text-violet-600">Next question in {startsIn}s</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Outcome who="You" pick={last.you} answer={last.answer} />
          {match.isDuel && <Outcome who={opp} pick={last.opp} answer={last.answer} />}
        </div>
        <p className="mt-3 text-base font-semibold leading-6 text-slate-800">{last.prompt}</p>
        <div className="mt-3 grid gap-2">
          {last.options.map((opt, i) => {
            const correct = i === last.answer;
            const mine = last.you === i;
            const theirs = last.opp === i;
            return (
              <div key={i} className={`flex items-center gap-3 rounded-2xl border p-3 text-sm font-semibold ${
                correct ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                  : mine ? "border-rose-300 bg-rose-50 text-rose-800"
                  : "border-slate-200 bg-white text-slate-500"
              }`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  correct ? "bg-emerald-500 text-white" : mine ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"
                }`}>{letter(i)}</span>
                <span className="min-w-0 flex-1 break-words">{opt}</span>
                {mine && <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase">You</span>}
                {theirs && <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase">{opp}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Live question ──────────────────────────────────────────────────────────
  if (!match.question) return null;
  const pick = match.yourPick ?? localPick;
  const locked = match.answered || pick !== null || busy || secondsLeft === 0;
  const urgent = secondsLeft <= 5;
  const warn = secondsLeft <= 10;

  return (
    <div className="rounded-[28px] bg-white p-5 ring-1 ring-slate-200 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Question {match.round + 1} of {match.total}
        </p>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black tabular-nums ${
          urgent ? "animate-pulse bg-rose-100 text-rose-700" : warn ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
        }`}>
          <Timer className="h-4 w-4" aria-hidden /> {secondsLeft}s
        </span>
      </div>

      {/* Draining clock bar */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={match.roundSeconds} aria-valuenow={secondsLeft} aria-label="Time left for this question">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-linear ${urgent ? "bg-rose-500" : warn ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${fraction * 100}%` }} />
      </div>

      <p className="text-lg font-semibold leading-7 text-slate-800">{match.question.prompt}</p>

      <div className="mt-4 grid gap-2.5">
        {match.question.options.map((opt, idx) => {
          const mine = pick === idx;
          return (
            <button key={idx} type="button" onClick={() => onAnswer(idx)} disabled={locked}
              aria-pressed={mine}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition ${
                mine ? "border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200"
                  : locked ? "border-slate-200 bg-white text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99]"
              }`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                mine ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
              }`}>{letter(idx)}</span>
              <span className="min-w-0 flex-1 break-words">{opt}</span>
              {mine && <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-violet-600">Locked in</span>}
            </button>
          );
        })}
      </div>

      {/* Status line */}
      <div className="mt-4 min-h-[1.25rem] text-sm font-semibold">
        {secondsLeft === 0 ? (
          <p className="text-slate-500">Time&apos;s up — moving on…</p>
        ) : locked && match.isDuel ? (
          <p className="text-violet-700">
            {match.oppAnswered ? `${opp} has answered too — next question coming up…` : `Answer locked in — waiting for ${opp}…`}
          </p>
        ) : locked ? (
          <p className="text-violet-700">Answer locked in…</p>
        ) : match.isDuel && match.oppAnswered ? (
          <p className="text-amber-700">{opp} has already answered — {secondsLeft}s left!</p>
        ) : null}
      </div>

      {!locked && (
        <button type="button" onClick={onSkip} className="mt-2 text-xs font-bold text-slate-400 hover:text-slate-600">
          Skip this question →
        </button>
      )}
    </div>
  );
}
