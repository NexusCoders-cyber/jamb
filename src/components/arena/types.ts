/** Shape of GET /api/quiz/match/[matchId] — shared by the Arena screens. */

export type RoundResult = {
  index: number;
  prompt: string;
  options: string[];
  answer: number;
  /** Option index each player picked; -1 = ran out of time; null = unknown. */
  you: number | null;
  opp: number | null;
};

export type ReviewItem = RoundResult & {
  id: string;
  explanation: string | null;
};

export type MatchState = {
  matchId: string;
  subject: string;
  status: "waiting" | "active" | "completed" | "declined" | "expired";
  yourSide: "host" | "guest";
  yourIndex: number;
  yourScore: number;
  yourFinished: boolean;
  oppScore: number;
  oppIndex: number;
  oppFinished: boolean;
  isDuel: boolean;
  currentTurn: "host" | "guest" | null;
  /** Server clock (epoch ms) when this state was produced — use it to correct local clock drift. */
  serverNow: number;
  turnEndsAt: string | null;
  roundStartsAt: string | null;
  roundSeconds: number;
  /** 0-based number of the question in play. */
  round: number;
  answered: boolean;
  oppAnswered: boolean;
  yourPick: number | null;
  lastRound: Omit<RoundResult, "index"> & { index: number } | null;
  winnerId: string | null;
  oppId: string | null;
  oppName: string | null;
  oppSeenAt: string | null;
  question: { id: string; prompt: string; options: string[]; subject?: string | null } | null;
  total: number;
  answerKey: Array<{ id: string; answer: number; explanation: string | null }> | null;
  review: ReviewItem[] | null;
};
