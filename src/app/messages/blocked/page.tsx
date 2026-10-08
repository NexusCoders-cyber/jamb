"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/useUser";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import AuthGuard from "@/components/AuthGuard";
import Avatar from "@/components/Avatar";
import { listBlocked, unblockUser } from "@/lib/dmSafety";

export default function BlockedUsersPage() {
  const { user, loading: authLoading } = useUser();
  const [list, setList] = useState<{ id: string; name: string; avatar: string | null }[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let live = true;
    listBlocked(createSupabaseBrowserClient(), user.id).then((l) => { if (live) setList(l); });
    return () => { live = false; };
  }, [user]);

  async function unblock(id: string) {
    if (!user) return;
    setError("");
    const err = await unblockUser(createSupabaseBrowserClient(), user.id, id);
    if (err) setError(err); else setList((l) => (l ?? []).filter((x) => x.id !== id));
  }

  if (authLoading || !user) return <AuthGuard user={user} loading={authLoading}><></></AuthGuard>;

  return (
    <main className="min-h-screen bg-[#eef2ff] px-4 py-6">
      <div className="mx-auto max-w-xl">
        <Link href="/messages" className="text-sm font-bold text-violet-600">← Messages</Link>
        <h1 className="mt-3 text-2xl font-black text-slate-900">Blocked people</h1>
        <p className="mt-1 text-sm text-slate-500">They can&apos;t message you and you won&apos;t see their messages. They aren&apos;t told that you blocked them.</p>
        {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
        <div className="mt-5 space-y-2">
          {list === null ? (
            <div className="h-16 animate-pulse rounded-2xl bg-white" />
          ) : list.length === 0 ? (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">You haven&apos;t blocked anyone.</p>
          ) : list.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <Avatar user={{ full_name: p.name, avatar_url: p.avatar }} />
              <p className="min-w-0 flex-1 truncate font-bold text-slate-900">{p.name}</p>
              <button type="button" onClick={() => void unblock(p.id)} className="rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700">Unblock</button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
