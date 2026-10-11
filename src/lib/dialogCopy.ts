/**
 * Wording for the in-app dialogs. Pure on purpose (no React, relative imports only) so the exact
 * text students read can be unit-tested — the exam-exit message in particular has to stay honest
 * about what leaving does.
 */

export type DialogTone = "info" | "warning" | "danger";

export type ConfirmCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: DialogTone;
  /** Which button is the big violet/rose one. "cancel" = the safe choice is the obvious one. */
  primary: "confirm" | "cancel";
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Leaving a timed exam ends it: the answers given so far are submitted and scored. */
export function leaveExamCopy(answered: number): ConfirmCopy {
  return {
    title: "Leave this exam?",
    message: `Leaving ends the exam. Your ${plural(answered, "answer", "answers")} so far will be submitted and scored.`,
    confirmLabel: "Leave and submit",
    cancelLabel: "Stay in the exam",
    tone: "warning",
    primary: "cancel",
  };
}

/** Study mode is never saved. */
export function leaveStudyCopy(questionCount?: number): ConfirmCopy {
  return {
    title: "Leave this session?",
    message: questionCount && questionCount > 0
      ? `Study sessions are not saved, so your progress on these ${questionCount} questions will be lost.`
      : "Study sessions are not saved, so your progress will be lost.",
    confirmLabel: "Leave session",
    cancelLabel: "Keep studying",
    tone: "info",
    primary: "cancel",
  };
}

export const signOutCopy: ConfirmCopy = {
  title: "Sign out?",
  message: "You will need to sign in again to continue practising.",
  confirmLabel: "Sign out",
  cancelLabel: "Stay signed in",
  tone: "info",
  primary: "cancel",
};

export const deleteMessageCopy: ConfirmCopy = {
  title: "Delete this message?",
  message: "It will be removed for both of you. This cannot be undone.",
  confirmLabel: "Delete message",
  cancelLabel: "Cancel",
  tone: "danger",
  primary: "confirm",
};

export function blockUserCopy(name: string): ConfirmCopy {
  return {
    title: `Block ${name}?`,
    message: "They will not be able to message you and you will not see their messages. They will not be told.",
    confirmLabel: "Block",
    cancelLabel: "Cancel",
    tone: "danger",
    primary: "confirm",
  };
}

export const deletePostCopy: ConfirmCopy = {
  title: "Delete this post?",
  message: "The post and its replies will be removed. This cannot be undone.",
  confirmLabel: "Delete post",
  cancelLabel: "Cancel",
  tone: "danger",
  primary: "confirm",
};

/** Quiz arena: `live` = an active duel (opponent wins), `duel` = a pending duel challenge. */
export function leaveGameCopy(state: { isDuel: boolean; live: boolean }): ConfirmCopy {
  if (state.isDuel && state.live) {
    return {
      title: "Leave this game?",
      message: "Your opponent wins immediately.",
      confirmLabel: "Leave game",
      cancelLabel: "Keep playing",
      tone: "danger",
      primary: "cancel",
    };
  }
  const what = state.isDuel ? "duel" : "game";
  return {
    title: `Cancel this ${what}?`,
    message: `The ${what} will be closed.`,
    confirmLabel: `Cancel ${what}`,
    cancelLabel: `Keep the ${what}`,
    tone: "warning",
    primary: "cancel",
  };
}

export type ReportReason = { id: string; label: string };

export const POST_REPORT_REASONS: readonly ReportReason[] = [
  { id: "spam", label: "Spam or advertising" },
  { id: "abusive", label: "Abusive or bullying" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "misleading", label: "Wrong or misleading" },
  { id: "other", label: "Something else" },
];

/** The text stored in content_reports.reason (column is short: keep it under 300 characters). */
export function formatReportReason(reasons: readonly ReportReason[], id: string, note: string): string {
  const label = reasons.find((r) => r.id === id)?.label ?? id;
  const extra = note.trim();
  return (extra ? `${label}: ${extra}` : label).slice(0, 300);
}
