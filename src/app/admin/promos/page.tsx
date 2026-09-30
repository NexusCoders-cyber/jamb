"use client";

/**
 * Admin — Promos. Dashboard banner slides: an image and/or write-up that
 * appears in the hero-card carousel on /dashboard (target-score card slides
 * into promos when any are active).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminRole } from "@/lib/useAdminRole";
import { Eye, EyeOff, Image as ImageIcon, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";

type PromoRow = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  is_active: boolean;
  created_at: string;
};

const EMPTY = { title: "", body: "", cta_label: "", cta_href: "" };

export default function AdminPromosPage() {
  const { user } = useAdminRole();
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(typeof EMPTY) & { id: string | null }>({ ...EMPTY, id: null });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState<{ url: string; path: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.from("promos").select("*").order("created_at", { ascending: false }).limit(50);
    setPromos(((data ?? []) as unknown) as PromoRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleFilePicked(file: File | null) {
    if (!file) return;
    setUploading(true);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await supabase.storage.from("promos").upload(path, file, { upsert: false });
    if (error) {
      setNotice({ text: `Upload failed: ${error.message}`, ok: false });
    } else {
      const { data } = supabase.storage.from("promos").getPublicUrl(path);
      setImage({ url: data.publicUrl, path });
    }
    setUploading(false);
  }

  async function save() {
    if (editing.title.trim().length < 3) { setNotice({ text: "Give the promo a title.", ok: false }); return; }
    if (!editing.body.trim() && !image) { setNotice({ text: "Add a write-up or a banner image.", ok: false }); return; }
    setSaving(true);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const values = {
      title: editing.title.trim(),
      body: editing.body.trim(),
      image_url: image?.url ?? null,
      cta_label: editing.cta_label.trim() || null,
      cta_href: editing.cta_href.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = editing.id
      ? await supabase.from("promos").update(values).eq("id", editing.id)
      : await supabase.from("promos").insert({ ...values, created_by: user?.id, is_active: true });
    if (res.error) {
      setNotice({ text: res.error.message, ok: false });
    } else {
      setNotice({ text: editing.id ? "Promo updated." : "Promo published — it appears on dashboards now.", ok: true });
      setShowForm(false);
      setEditing({ ...EMPTY, id: null });
      setImage(null);
      void load();
    }
    setSaving(false);
  }

  async function toggleActive(promo: PromoRow) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("promos").update({ is_active: !promo.is_active }).eq("id", promo.id);
    if (!error) setPromos((prev) => prev.map((p) => (p.id === promo.id ? { ...p, is_active: !promo.is_active } : p)));
  }

  async function remove(promo: PromoRow) {
    if (!window.confirm(`Delete promo "${promo.title}"?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("promos").delete().eq("id", promo.id);
    if (!error) setPromos((prev) => prev.filter((p) => p.id !== promo.id));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Growth</p>
          <h1 className="mt-1 text-2xl font-black text-white">Promo banners</h1>
          <p className="mt-1 text-sm text-slate-500">Active promos slide into the dashboard hero card.</p>
        </div>
        <button type="button" onClick={() => { setEditing({ ...EMPTY, id: null }); setImage(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" aria-hidden /> New promo
        </button>
      </header>

      {notice && (
        <p className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${notice.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          {notice.text}
        </p>
      )}

      {showForm && (
        <section className="mb-6 rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <h2 className="mb-4 text-base font-black text-white">{editing.id ? "Edit promo" : "New promo"}</h2>

          {/* Banner image */}
          <div className="flex flex-wrap items-center gap-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => void handleFilePicked(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/60 hover:border-violet-500 disabled:opacity-50">
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" aria-hidden />
              ) : image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt="Banner preview" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs font-bold text-slate-500">
                  <ImageIcon className="h-6 w-6" aria-hidden /> Upload image
                </span>
              )}
            </button>
            {image && (
              <button type="button" onClick={() => setImage(null)} className="text-xs font-bold text-rose-400 hover:text-rose-300">
                Remove image
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</span>
              <input type="text" value={editing.title} onChange={(e) => setEditing((c) => ({ ...c, title: e.target.value }))}
                placeholder="e.g. Qubit Masterclass — 50% off"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm font-bold text-white placeholder-slate-500 outline-none focus:border-violet-500" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Write-up</span>
              <textarea value={editing.body} onChange={(e) => setEditing((c) => ({ ...c, body: e.target.value }))} rows={3} maxLength={300}
                placeholder="Short pitch shown under the title on the banner…"
                className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Button label (optional)</span>
                <input type="text" value={editing.cta_label} onChange={(e) => setEditing((c) => ({ ...c, cta_label: e.target.value }))}
                  placeholder="e.g. Enroll now"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Button link (optional)</span>
                <input type="text" value={editing.cta_href} onChange={(e) => setEditing((c) => ({ ...c, cta_href: e.target.value }))}
                  placeholder="e.g. /exam or https://…"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setImage(null); }}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? "Publishing…" : editing.id ? "Save changes" : "Publish promo"}
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-slate-900" />)}</div>
      ) : promos.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 p-10 text-center ring-1 ring-slate-800">
          <Megaphone className="mx-auto h-8 w-8 text-slate-600" aria-hidden />
          <p className="mt-3 text-base font-black text-white">No promos yet</p>
          <p className="mt-2 text-sm text-slate-500">Published promos rotate in the dashboard hero card.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map((p) => (
            <div key={p.id} className="flex items-start gap-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-800">
                  <Megaphone className="h-6 w-6 text-slate-600" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-black text-white">{p.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>
                    {p.is_active ? "Live" : "Hidden"}
                  </span>
                </div>
                {p.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{p.body}</p>}
                {p.cta_label && <p className="mt-1 text-[10px] font-bold text-violet-400">Button: {p.cta_label} → {p.cta_href}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => void toggleActive(p)} aria-label={p.is_active ? "Hide promo" : "Show promo"}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                  {p.is_active ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
                <button type="button" onClick={() => void remove(p)} aria-label="Delete promo"
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
