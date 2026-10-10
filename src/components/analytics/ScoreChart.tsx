"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { nearestIndex, scoreSeries, spreadX, yScale, type AttemptLike } from "@/lib/trends";

const W = 320;
const H = 190;
const PAD = { l: 32, r: 14, t: 16, b: 26 };

/**
 * Score over time: one dot per finished session at its real date, marks out of 400 (the same number the
 * dashboard shows). Tap or drag across the chart, or use the arrow keys, to read any session.
 */
export default function ScoreChart({ attempts, target }: { attempts: AttemptLike[]; target: number }) {
  const gradId = useId();
  const [mocksOnly, setMocksOnly] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const allPoints = useMemo(() => scoreSeries(attempts, { max: 20 }), [attempts]);
  const points = useMemo(() => (mocksOnly ? scoreSeries(attempts, { mocksOnly: true, max: 20 }) : allPoints), [attempts, mocksOnly, allPoints]);
  const hasMocks = useMemo(() => allPoints.some((p) => p.kind === "mock"), [allPoints]);

  const geo = useMemo(() => {
    const scale = yScale(points.map((p) => p.jamb), target);
    const xs = spreadX(points.map((p) => p.t));
    const px = xs.map((x) => PAD.l + x * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - (v - scale.min) / (scale.max - scale.min)) * (H - PAD.t - PAD.b);
    return { scale, px, y };
  }, [points, target]);

  if (points.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-slate-500">
          {mocksOnly ? "No full mock exams in this period." : "No exams in this period."}
        </p>
        {mocksOnly ? (
          <button type="button" onClick={() => setMocksOnly(false)} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
            Show all sessions
          </button>
        ) : (
          <Link href="/exam" className="rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700">
            Take a mock exam
          </Link>
        )}
      </div>
    );
  }

  const selIdx = Math.max(0, picked ? points.findIndex((p) => p.id === picked) : points.length - 1);
  const sel = points[selIdx];
  const prev = selIdx > 0 ? points[selIdx - 1] : null;
  const delta = prev ? sel.jamb - prev.jamb : null;
  const best = points.reduce((b, p) => (p.jamb > b.jamb ? p : b), points[0]);
  const { scale, px, y } = geo;
  const targetInside = target >= scale.min && target <= scale.max;

  const line = points.map((_, i) => `${i === 0 ? "M" : "L"}${px[i].toFixed(1)},${y(points[i].jamb).toFixed(1)}`).join(" ");
  const area = `${line} L${px[px.length - 1].toFixed(1)},${H - PAD.b} L${px[0].toFixed(1)},${H - PAD.b} Z`;

  // date labels: first, last and up to two in between, skipping any that would touch
  const labelIdx = Array.from(new Set([0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1])).filter(
    (i, k, a) => k === 0 || px[i] - px[a[k - 1]] > 52,
  );

  const select = (i: number) => setPicked(points[Math.min(points.length - 1, Math.max(0, i))].id);
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const i = nearestIndex(px, ((e.clientX - rect.left) / rect.width) * W);
    if (i >= 0) select(i);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") select(selIdx - 1);
    else if (e.key === "ArrowRight") select(selIdx + 1);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(points.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-black tabular-nums leading-none text-slate-900">
            {sel.jamb}
            <span className="text-base font-bold text-slate-400"> / 400</span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-slate-500">
            <span>{sel.label}</span>
            {delta !== null && delta !== 0 && (
              <span className={delta > 0 ? "text-emerald-600" : "text-rose-600"}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} since the one before
              </span>
            )}
            {delta === 0 && <span>same as the one before</span>}
          </p>
        </div>
        {hasMocks && (
          <div className="flex shrink-0 gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Which sessions to show">
            {[
              { v: false, label: "All" },
              { v: true, label: "Mocks" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={mocksOnly === o.v}
                onClick={() => {
                  setMocksOnly(o.v);
                  setPicked(null);
                }}
                className={`min-h-8 touch-manipulation rounded-full px-3 text-xs font-bold ${mocksOnly === o.v ? "bg-violet-600 text-white" : "text-slate-600"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="mt-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        tabIndex={0}
        role="group"
        aria-label={`Score over time. ${points.length} sessions. Use the left and right arrow keys to move between them.`}
        onKeyDown={onKey}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full select-none"
          style={{ touchAction: "pan-y" }}
          onPointerDown={fromPointer}
          onPointerMove={(e) => e.buttons > 0 && fromPointer(e)}
          role="img"
          aria-label={`Marks out of 400 for ${points.length} sessions, from ${points[0].jamb} to ${points[points.length - 1].jamb}. Target ${target}.`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-line)" stopOpacity="0.28" />
              <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* y axis */}
          {scale.ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} style={{ stroke: "var(--chart-grid)" }} strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" style={{ fill: "var(--chart-axis)" }}>
                {v}
              </text>
            </g>
          ))}

          {/* target */}
          {targetInside && (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} style={{ stroke: "var(--chart-target)" }} strokeWidth="1.5" strokeDasharray="5 4" />
              <text x={W - PAD.r} y={y(target) - 4} textAnchor="end" fontSize="9" fontWeight="700" style={{ fill: "var(--chart-target)" }}>
                Target {target}
              </text>
            </g>
          )}

          {/* x axis dates */}
          {labelIdx.map((i) => (
            <text key={points[i].id} x={px[i]} y={H - 8} textAnchor={i === 0 && px[i] < PAD.l + 14 ? "start" : i === points.length - 1 && px[i] > W - PAD.r - 14 ? "end" : "middle"} fontSize="9" style={{ fill: "var(--chart-axis)" }}>
              {points[i].label}
            </text>
          ))}

          {points.length > 1 && (
            <>
              <path d={area} fill={`url(#${gradId})`} />
              <path d={line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: "var(--chart-line)" }} />
            </>
          )}

          {/* selection guide */}
          <line x1={px[selIdx]} x2={px[selIdx]} y1={PAD.t} y2={H - PAD.b} strokeWidth="1" strokeDasharray="2 3" style={{ stroke: "var(--chart-axis)" }} />

          {points.map((p, i) => {
            const cx = px[i];
            const cy = y(p.jamb);
            const isSel = i === selIdx;
            return (
              <g key={p.id}>
                {p.id === best.id && points.length > 2 && <circle cx={cx} cy={cy} r="9" fill="none" strokeWidth="1.5" style={{ stroke: "var(--chart-target)" }} />}
                {isSel && <circle cx={cx} cy={cy} r="11" style={{ fill: "var(--chart-line)" }} opacity="0.18" />}
                {p.kind === "mock" ? (
                  <circle cx={cx} cy={cy} r={isSel ? 6 : 5} strokeWidth="2" style={{ fill: "var(--chart-mock)", stroke: "var(--chart-ring)" }} />
                ) : (
                  <circle cx={cx} cy={cy} r={isSel ? 5 : 4} strokeWidth="2.25" style={{ fill: "var(--chart-ring)", stroke: "var(--chart-line)" }} />
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200" aria-live="polite">
        <p className="text-sm font-black text-slate-900">
          {sel.kind === "mock" ? "Full mock exam" : "Practice session"}
          <span className="font-semibold text-slate-500"> · {sel.label}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {sel.correct} of {sel.total} correct ({sel.pct}%) · {sel.jamb}/400
          {sel.id === best.id && points.length > 2 ? " · your best here" : ""}
        </p>
      </div>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-mock)" }} aria-hidden /> Full mock
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--chart-line)" }} aria-hidden /> Practice
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--chart-target)" }} aria-hidden /> Target
        </span>
      </p>

      <ol className="sr-only">
        {points.map((p) => (
          <li key={p.id}>
            {p.label}: {p.kind === "mock" ? "mock" : "practice"}, {p.jamb} out of 400, {p.correct} of {p.total} correct
          </li>
        ))}
      </ol>
    </div>
  );
}
