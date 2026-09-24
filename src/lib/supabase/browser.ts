import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) {
    throw new Error("Supabase public env vars are not set. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the dev server.");
  }
  return createBrowserClient(url, anonKey);
}
