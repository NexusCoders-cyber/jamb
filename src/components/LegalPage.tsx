import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for the public Privacy / Terms pages (no login needed, readable on a phone). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <main className="selectable mx-auto min-h-dvh max-w-2xl bg-[#f5f4ff] px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-slate-800">
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-sm font-bold text-violet-700">← Back to Qubit</Link>
      <h1 className="text-3xl font-black text-slate-900">{title}</h1>
      <p className="mt-1 text-xs font-semibold text-slate-500">Last updated {updated}</p>
      <div className="mt-6 space-y-6 text-[15px] leading-7 [&_h2]:mb-1 [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
        {support && (
          <section>
            <h2>Contact</h2>
            <p>Questions? Email <a className="font-bold text-violet-700 underline" href={`mailto:${support}`}>{support}</a>.</p>
          </section>
        )}
      </div>
    </main>
  );
}
