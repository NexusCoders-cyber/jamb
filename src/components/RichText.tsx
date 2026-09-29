"use client";

/**
 * RichText — renders rich text segments (italics/bold preserved from the
 * ALOC API) as plain React nodes. English lexis questions mark keywords in
 * <i>/<em>; without this component the emphasis is silently lost.
 */

export type Segment = { text: string; italic?: boolean; bold?: boolean };

export function segmentsOf(value: string | Segment[] | null | undefined): Segment[] | null {
  if (!value) return null;
  if (typeof value === "string") return null;
  return value.some((s) => s.italic || s.bold) ? value : null;
}

export default function RichText({
  segments,
  fallback,
  className,
}: {
  segments?: Segment[] | null;
  /** Plain string rendered when no rich segments are available */
  fallback?: string | null;
  className?: string;
}) {
  const list = segmentsOf(segments);
  if (list) {
    return (
      <span className={className}>
        {list.map((s, i) =>
          s.italic ? (
            <em key={i}>{s.text}</em>
          ) : s.bold ? (
            <strong key={i}>{s.text}</strong>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </span>
    );
  }
  return <span className={className}>{fallback}</span>;
}
