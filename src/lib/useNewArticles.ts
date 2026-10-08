"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { countNew } from "@/lib/blogClient";

/** How many blog articles the student hasn't opened yet (for the little "new" badge). Quiet when offline. */
export function useNewArticles(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try { supabase = createSupabaseBrowserClient(); } catch { return; }
    const run = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const { data, error } = await supabase.from("blog_posts").select("slug, published_at").eq("is_published", true).order("published_at", { ascending: false }).limit(20);
      if (alive && !error && data) setN(countNew(data as { slug: string; published_at: string | null }[]));
    };
    void run();
    const again = () => void run();
    window.addEventListener("focus", again);
    window.addEventListener("qubit-blog-read", again);
    return () => { alive = false; window.removeEventListener("focus", again); window.removeEventListener("qubit-blog-read", again); };
  }, []);
  return n;
}
