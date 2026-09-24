import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#eef2ff] px-4 text-center">
      <div className="rounded-[32px] bg-white p-10 shadow-[0_18px_60px_rgba(93,74,228,0.1)] ring-1 ring-slate-200 max-w-md w-full">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 text-4xl">
          🔭
        </div>
        <h1 className="text-6xl font-black text-violet-600">404</h1>
        <h2 className="mt-3 text-2xl font-black text-slate-900">Page not found</h2>
        <p className="mt-3 text-sm text-slate-500">
          This page doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/dashboard" className="flex h-12 items-center justify-center rounded-2xl bg-violet-600 text-sm font-bold text-white">
            Go to dashboard
          </Link>
          <Link href="/practice" className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700">
            Start practising
          </Link>
        </div>
      </div>
    </main>
  );
}
