"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { isLocalBookmarked, removeLocalBookmark, setLocalBookmark, subscribeLocal } from "@/lib/localDb";
import type { QuestionSnapshot } from "@/lib/queries";

/** Save / unsave a question on this device (works offline; synced to the account on the next backup). */
export default function BookmarkButton({
  snapshot,
  subject,
  className = "",
  label = true,
}: {
  snapshot: QuestionSnapshot;
  subject: string;
  className?: string;
  /** Show the word next to the icon  */
  label?: boolean;
}) {
  const { user } = useUser();
  const userId = user?.id;
  const [saved, setSaved] = useState(false);
  const questionId = snapshot.id;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setSaved(await isLocalBookmarked(userId, questionId));
  }, [userId, questionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    return subscribeLocal(() => void refresh());
  }, [refresh]);

  if (!userId) return null;

  async function toggle() {
    if (!userId) return;
    if (saved) await removeLocalBookmark(userId, questionId);
    else await setLocalBookmark(userId, snapshot, subject);
    await refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={saved}
      aria-label={saved ? "Remove bookmark" : "Bookmark this question"}
      className={`inline-flex touch-manipulation items-center gap-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold sm:px-4 sm:py-2 ${saved ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-700"} ${className}`}
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} aria-hidden />
      {label && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
