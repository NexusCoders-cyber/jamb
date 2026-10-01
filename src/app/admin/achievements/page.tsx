"use client";

/**
 * Admin — Achievements. Full CRUD over achievement definitions, including
 * PNG-only icon uploads to the public `achievements` storage bucket.
 * Unlocks are server-computed; this page only manages definitions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ImagePlus, Loader2, Pencil, Power, Trash2, Trophy } from "lucide-react";

type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  points: number;
  icon_url: string | null;
  is_active: boolean;
  position: number;
};

export default function AdminAchievementsPage() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editor
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("10");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<Achievement | null>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("achievements").select("*").order("position");
    setItems(((data ?? []) as unknown) as Achievement[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setPoints("10");
    setFormOpen(true);
  }

  function openEdit(a: Achievement) {
    setEditing(a);
    setCode(a.code);
    setName(a.name);
    setDescription(a.description ?? "");
    setPoints(String(a.points));
    setFormOpen(true);
  }

  async function save() {
    if (!code.trim() || !name.trim()) { setNotice("Code and name are required."); return; }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const payload = {
      code: code.trim().toLowerCase().replace(/\s+/g, "_"),
      name: name.trim(),
      description: description.trim(),
      points: Math.max(0, parseInt(points, 10) || 0),
    };
    const { error } = editing
      ? await supabase.from("achievements").update(payload).eq("id", editing.id)
      : await supabase.from("achievements").insert({ ...payload, position: items.length + 1 });
    setNotice(error ? error.message : editing ? "Achievement updated." : "Achievement created.");
    setBusy(false);
    setFormOpen(false);
    void load();
  }

  async function toggleActive(a: Achievement) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("achievements").update({ is_active: !a.is_active }).eq("id", a.id);
    setNotice(error ? error.message : a.is_active ? "Achievement hidden." : "Achievement activated.");
    void load();
  }

  async function remove(a: Achievement) {
    if (!window.confirm(`Delete "${a.name}"? Students keep their unlocks.`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("achievements").delete().eq("id", a.id);
    setNotice(error ? error.message : "Achievement deleted.");
    void load();
  }

  /**
   * PNG-only icon upload. Validation: accept attr, file.type check AND
   * extension check before anything is sent to storage.
   */
  async function uploadIcon(a: Achievement, file: File | undefined) {
    if (!file) return;
    const isPng = file.type === "image/png" && file.name.toLowerCase().endsWith(".png");
    if (!isPng) {
      setNotice("Only PNG images are accepted for achievement icons.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Icon must be under 2 MB.");
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${a.code}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("achievements")
        .upload(path, file, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("achievements").getPublicUrl(path);
      const { error: dbErr } = await supabase
        .from("achievements")
        .update({ icon_url: data.publicUrl })
        .eq("id", a.id);
      if (dbErr) throw dbErr;
      setNotice(`Icon uploaded for ${a.name}.`);
      void load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-violet-400">
            <Trophy className="h-4 w-4" aria-hidden /> Achievements
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">Manage achievements</h1>
        </div>
        <button type="button" onClick={openCreate}
          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-700">
          + New achievement
        </button>
      </header>

      {notice && (
        <div className="mb-4 rounded-2xl bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-300 ring-1 ring-violet-500/30">
          {notice}
        </div>
      )}

      {/* One shared PNG input — the icon button sets which achievement it's for.
          (A ref inside the .map() would always point at the last row.) */}
      <input ref={fileRef} type="file" accept="image/png,.png" className="hidden"
        onChange={(e) => {
          if (uploadTarget) void uploadIcon(uploadTarget, e.target.files?.[0]);
          setUploadTarget(null);
          e.target.value = "";
        }} />

      {/* Editor form */}
      {formOpen && (
        <section className="mb-6 rounded-3xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <p className="text-sm font-black text-white">{editing ? `Edit: ${editing.name}` : "New achievement"}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-slate-400">Code (stable id, e.g. duel_win_5)</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} disabled={Boolean(editing)}
                className="mt-1 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500 disabled:opacity-50" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-slate-400">Description</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400">Points (QPoints bonus on unlock)</span>
              <input value={points} onChange={(e) => setPoints(e.target.value)} inputMode="numeric"
                className="mt-1 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-violet-500" />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void save()} disabled={busy}
              className="rounded-full bg-violet-600 px-5 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50">
              {busy ? "Saving…" : editing ? "Save changes" : "Create achievement"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)}
              className="rounded-full px-4 py-2 text-xs font-black text-slate-400 hover:text-white">
              Cancel
          </button>
          </div>
        </section>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-900" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl bg-slate-900 p-8 text-center ring-1 ring-slate-800">
          <p className="font-black text-white">No achievements yet.</p>
          <p className="mt-1 text-xs text-slate-400">Run supabase/achievements.sql to seed the starter set.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              {/* Icon */}
              <div className="relative shrink-0">
                {a.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.icon_url} alt={`${a.name} icon`} className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-700" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-slate-500">
                    <Trophy className="h-6 w-6" aria-hidden />
                  </span>
                )}
                <button type="button" onClick={() => { setUploadTarget(a); fileRef.current?.click(); }} aria-label={`Upload PNG icon for ${a.name}`}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white shadow hover:bg-violet-700">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-white">{a.name}</p>
                <p className="truncate text-xs text-slate-400">{a.description || "No description"}</p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-600">{a.code} · {a.points} pts</p>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => openEdit(a)} aria-label={`Edit ${a.name}`}
                  className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white">
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => void toggleActive(a)} aria-label={a.is_active ? "Deactivate" : "Activate"}
                  className={`rounded-full p-2 ${a.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                  <Power className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => void remove(a)} aria-label={`Delete ${a.name}`}
                  className="rounded-full bg-rose-500/10 p-2 text-rose-400 hover:bg-rose-500/20">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
