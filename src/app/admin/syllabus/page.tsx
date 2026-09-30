"use client";

/**
 * Admin — Syllabus. Manage per-subject syllabus content:
 * text entries (topics/notes) and file uploads (PDF/image/doc) that appear on
 * the student-facing subject page at /knowledge-hub/[subject].
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAdminRole } from "@/lib/useAdminRole";
import { ALOC_SUBJECTS } from "@/lib/aloc";
import { getAllSyllabus, type SyllabusItem } from "@/lib/queries";
import { Plus, Pencil, Trash2, Loader2, FileText, Paperclip } from "lucide-react";

const SUBJECTS = ALOC_SUBJECTS.map((s) => s.name);

const EMPTY = { subject: SUBJECTS[0] ?? "", title: "", body: "" };

export default function AdminSyllabusPage() {
  const { user } = useAdminRole();
  const [items, setItems] = useState<SyllabusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<(typeof EMPTY) & { id: string | null }>({ ...EMPTY, id: null });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<{ url: string; name: string } | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const rows = await getAllSyllabus(supabase);
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startNew() {
    setEditing({ ...EMPTY, subject: filter !== "all" ? filter : SUBJECTS[0] ?? "", id: null });
    setAttached(null);
    setShowForm(true);
  }

  function startEdit(item: SyllabusItem) {
    setEditing({ id: item.id, subject: item.subject, title: item.title, body: item.body });
    setAttached(item.file_url ? { url: item.file_url, name: item.file_name ?? "attachment" } : null);
    setShowForm(true);
  }

  async function uploadFile(file: File): Promise<{ url: string; name: string } | null> {
    const supabase = createSupabaseBrowserClient();
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const { error } = await supabase.storage.from("syllabus").upload(path, file, { upsert: false });
    if (error) {
      setNotice({ text: `Upload failed: ${error.message}`, ok: false });
      return null;
    }
    const { data } = supabase.storage.from("syllabus").getPublicUrl(path);
    return { url: data.publicUrl, name: file.name };
  }

  async function handleFilePicked(file: File | null) {
    if (!file) return;
    setUploading(true);
    setNotice(null);
    const res = await uploadFile(file);
    if (res) setAttached(res);
    setUploading(false);
  }

  async function save() {
    if (editing.title.trim().length < 2) { setNotice({ text: "Give the entry a title.", ok: false }); return; }
    if (!editing.body.trim() && !attached) { setNotice({ text: "Add text or attach a file.", ok: false }); return; }
    setSaving(true);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const values = {
      subject: editing.subject,
      title: editing.title.trim(),
      body: editing.body.trim(),
      file_url: attached?.url ?? null,
      file_name: attached?.name ?? null,
      updated_at: new Date().toISOString(),
    };
    const res = editing.id
      ? await supabase.from("syllabus_items").update(values).eq("id", editing.id)
      : await supabase.from("syllabus_items").insert({ ...values, created_by: user?.id, position: items.filter((i) => i.subject === editing.subject).length });
    if (res.error) {
      setNotice({ text: res.error.message, ok: false });
    } else {
      setNotice({ text: editing.id ? "Entry updated." : "Entry added.", ok: true });
      setShowForm(false);
      setEditing({ ...EMPTY, id: null });
      setAttached(null);
      void load();
    }
    setSaving(false);
  }

  async function remove(item: SyllabusItem) {
    if (!window.confirm(`Delete "${item.title}" from ${item.subject}?`)) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("syllabus_items").delete().eq("id", item.id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const visible = filter === "all" ? items : items.filter((i) => i.subject === filter);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-400">Learning</p>
          <h1 className="mt-1 text-2xl font-black text-white">Syllabus</h1>
          <p className="mt-1 text-sm text-slate-500">Per-subject content students see at /knowledge-hub.</p>
        </div>
        <button type="button" onClick={startNew}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-500">
          <Plus className="h-4 w-4" aria-hidden /> New entry
        </button>
      </header>

      {/* Subject filter chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {["all", ...SUBJECTS].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filter === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}>
            {s === "all" ? "All subjects" : s}
          </button>
        ))}
      </div>

      {notice && (
        <p className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${notice.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
          {notice.text}
        </p>
      )}

      {/* Editor card */}
      {showForm && (
        <section className="mb-6 rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <h2 className="mb-4 text-base font-black text-white">{editing.id ? "Edit entry" : "New syllabus entry"}</h2>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Subject</span>
              <select value={editing.subject} onChange={(e) => setEditing((c) => ({ ...c, subject: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500">
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Title</span>
              <input type="text" value={editing.title} onChange={(e) => setEditing((c) => ({ ...c, title: e.target.value }))}
                placeholder="e.g. Algebra & equations — full topic list"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Content</span>
            <textarea value={editing.body} onChange={(e) => setEditing((c) => ({ ...c, body: e.target.value }))} rows={6}
              placeholder={"Paste or type the syllabus content…\n\nYou can use simple structure:\n- Topic: sub-items"}
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500" />
          </label>

          {/* Attachment */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => void handleFilePicked(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}
              {uploading ? "Uploading…" : "Attach file (PDF / image)"}
            </button>
            {attached && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <FileText className="h-3.5 w-3.5" aria-hidden /> {attached.name}
                <button type="button" onClick={() => setAttached(null)} className="ml-1 text-emerald-400 hover:text-white" aria-label="Remove attachment">×</button>
              </span>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setAttached(null); }}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? "Saving…" : editing.id ? "Save changes" : "Add entry"}
            </button>
          </div>
        </section>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-900" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 p-10 text-center ring-1 ring-slate-800">
          <p className="text-base font-black text-white">No syllabus entries yet</p>
          <p className="mt-2 text-sm text-slate-500">Add the first entry — students will see it on the subject page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">{item.subject}</p>
                  <p className="mt-0.5 truncate text-sm font-black text-white">{item.title}</p>
                  {item.body && <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-slate-400">{item.body}</p>}
                  {item.file_url && (
                    <a href={item.file_url} target="_blank" rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-violet-400 hover:text-violet-300">
                      <FileText className="h-3.5 w-3.5" aria-hidden /> {item.file_name ?? "Attachment"}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => startEdit(item)} aria-label="Edit"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><Pencil className="h-4 w-4" aria-hidden /></button>
                  <button type="button" onClick={() => void remove(item)} aria-label="Delete"
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
