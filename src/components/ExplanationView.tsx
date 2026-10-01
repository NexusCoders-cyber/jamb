"use client";

import { useMemo } from "react";
import { formatExplanationText, parseExplanation } from "@/lib/explanation";
import QuestionImage from "@/components/QuestionImage";

type Props = {
  text: string;
  /** Subject name (e.g. "Physics") — decides which notation rules apply (H₂O, V₁, m/s² …) */
  subject?: string | null;
  /** Diagrams that belong to the explanation */
  images?: string[];
  className?: string;
};

const markerLabel = (m: string): string => m.replace(/^Step\s*/i, "").replace(/[().]/g, "");

/**
 * A worked solution, laid out so each step is on its own line:
 *   • labels ("Given:", "Formula:") as small headings
 *   • numbered / lettered steps with a badge
 *   • equations in their own box (long ones wrap instead of running off the screen)
 *   • the final answer highlighted
 * The text is formatted again here (formatExplanationText is idempotent) so attempts saved before this
 * existed — stored as one run-together line — also display properly.
 */
export default function ExplanationView({ text, subject = null, images, className = "" }: Props) {
  const blocks = useMemo(() => parseExplanation(formatExplanationText(text, subject)), [text, subject]);

  return (
    <div className={`space-y-1.5 ${className}`} role="group" aria-label="Explanation">
      {blocks.map((b, i) => {
        const gap = b.gap ? "!mt-3.5" : "";
        switch (b.kind) {
          case "label":
            return (
              <p key={i} className={`pt-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700 ${gap}`}>
                {b.text}
              </p>
            );
          case "step":
            return (
              <div key={i} className={`flex items-start gap-2.5 ${gap}`}>
                <span className="mt-0.5 inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-black text-white">
                  {markerLabel(b.marker)}
                </span>
                <p className="min-w-0 flex-1 break-words text-sm leading-6 text-slate-800">{b.text}</p>
              </div>
            );
          case "equation":
            return (
              <p
                key={i}
                className={`whitespace-pre-wrap break-words rounded-xl bg-white px-3 py-2 text-[15px] font-semibold leading-7 text-slate-900 ring-1 ring-emerald-100 ${gap}`}
              >
                {b.text}
              </p>
            );
          case "answer":
            return (
              <div key={i} className={`rounded-xl bg-emerald-600 px-3.5 py-2.5 text-white ${gap}`}>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">Answer</span>
                <p className="mt-0.5 break-words text-[15px] font-bold leading-6">{b.text}</p>
              </div>
            );
          default:
            return (
              <p key={i} className={`break-words text-sm leading-6 text-slate-700 ${gap}`}>
                {b.text}
              </p>
            );
        }
      })}
      {(images?.length ?? 0) > 0 && (
        <div className="grid gap-3 pt-1">
          {images!.map((src) => (
            <QuestionImage key={src} src={src} />
          ))}
        </div>
      )}
    </div>
  );
}
