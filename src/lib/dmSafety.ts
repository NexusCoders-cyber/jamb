import type { SupabaseClient } from "@supabase/supabase-js";

export type DmReason = "harassment" | "spam" | "inappropriate" | "scam" | "other";
export const DM_REASONS: { id: DmReason; label: string }[] = [
  { id: "harassment", label: "Bullying or harassment" },
  { id: "inappropriate", label: "Inappropriate or sexual content" },
  { id: "scam", label: "Scam or asking for money" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Something else" },
];

const NOT_READY = "This feature isn't switched on yet. Please try again later.";

/** Turns a database error into a short sentence a student can read. */
function explain(message: string | undefined): string {
  const m = message ?? "";
  if (/too_many_reports/.test(m)) return "You've sent a lot of reports today. Please try again tomorrow.";
  if (/message_not_found|user_not_found/.test(m)) return "That message or person could not be found.";
  if (/cannot_report_own/.test(m)) return "You can't report your own message.";
  if (/function .*report_dm|relation .*(user_blocks|dm_reports)|schema cache|does not exist/i.test(m)) return NOT_READY;
  return "Something went wrong. Please try again.";
}

/** Report a message (or, with messageId = null, the person). Returns an error sentence, or null on success. */
export async function reportDM(
  supabase: SupabaseClient,
  args: { userId: string; messageId: string | null; reason: DmReason; note?: string },
): Promise<string | null> {
  const { error } = await supabase.rpc("report_dm", {
    p_user: args.messageId ? null : args.userId,
    p_message: args.messageId,
    p_reason: args.reason,
    p_note: args.note?.trim() || null,
  });
  return error ? explain(error.message) : null;
}

export async function blockUser(supabase: SupabaseClient, me: string, other: string): Promise<string | null> {
  const { error } = await supabase.from("user_blocks").upsert({ blocker_id: me, blocked_id: other }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  return error ? explain(error.message) : null;
}

export async function unblockUser(supabase: SupabaseClient, me: string, other: string): Promise<string | null> {
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", other);
  return error ? explain(error.message) : null;
}

/** Have I blocked this person? false when the table isn't there yet. */
export async function isBlocked(supabase: SupabaseClient, me: string, other: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me).eq("blocked_id", other).maybeSingle();
  return !error && !!data;
}

export async function listBlocked(supabase: SupabaseClient, me: string): Promise<{ id: string; name: string; avatar: string | null }[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, user:profiles!blocked_id(full_name, avatar_url)")
    .eq("blocker_id", me)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  type Row = { blocked_id: string; user: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null };
  return (data as unknown as Row[]).map((r) => {
    const u = Array.isArray(r.user) ? r.user[0] : r.user;
    return { id: r.blocked_id, name: u?.full_name || "Student", avatar: u?.avatar_url ?? null };
  });
}
