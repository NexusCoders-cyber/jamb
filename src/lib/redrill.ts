/**
 * Turn a student's wrong answers into a fresh practice session they can re-attempt.
 * The session is written in the same format the exam page uses for "resume unfinished exam", so the exam page
 * simply resumes it (/exam?mode=practice&resume=1) — no new exam code path, and everything stays on the device.
 */
import { newId, saveLocalSession } from "./localDb";
import type { AttemptAnswer, QuestionSnapshot } from "./queries";

export const REDRILL_MAX = 40;

type DrillQuestion = {
  id: string;
  prompt: string;
  promptSegments?: QuestionSnapshot["prompt_segments"];
  options: string[];
  optionSegments?: QuestionSnapshot["option_segments"];
  answer: number;
  explanation: string | null;
  image?: string | null;
  images?: string[];
  optionImages?: (string | null)[];
  sectionImages?: string[];
  explanationImages?: string[];
  section?: string | null;
  sectionKind?: "passage" | "instruction" | null;
  passageId?: string | null;
  novel?: string | null;
  year?: string | null;
  subject?: string | null;
};

function toDrillQuestion(q: QuestionSnapshot): DrillQuestion {
  return {
    id: q.id,
    prompt: q.prompt,
    promptSegments: q.prompt_segments ?? undefined,
    options: q.options,
    optionSegments: q.option_segments ?? undefined,
    answer: q.correct_option,
    explanation: q.explanation,
    image: q.image ?? undefined,
    images: q.images ?? undefined,
    optionImages: q.option_images ?? undefined,
    sectionImages: q.section_images ?? undefined,
    explanationImages: q.explanation_images ?? undefined,
    section: q.section ?? undefined,
    sectionKind: q.section_kind ?? undefined,
    passageId: q.passage_id ?? undefined,
    novel: q.novel ?? undefined,
    year: q.year ?? undefined,
    subject: q.subject_name ?? undefined,
  };
}

/** Distinct questions the student got wrong, newest mistakes first, capped. Optionally one subject only. */
export function pickMistakeQuestions(answers: AttemptAnswer[], subject?: string, max = REDRILL_MAX): QuestionSnapshot[] {
  const seen = new Set<string>();
  const out: QuestionSnapshot[] = [];
  for (const a of answers) {
    const q = a.question;
    if (!q || !Array.isArray(q.options) || q.options.length < 2) continue;
    if (subject && (q.subject_name ?? "Unknown") !== subject) continue;
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
    if (out.length >= max) break;
  }
  return out;
}

/** Save the drill as the student's practice session on this device. Returns how many questions it holds. */
export async function startMistakeRedrill(userId: string, snapshots: QuestionSnapshot[], label = "Mistake re-drill"): Promise<number> {
  if (snapshots.length === 0) return 0;
  // Keep each subject together (the exam screen shows one tab per subject)
  const bySubject = new Map<string, DrillQuestion[]>();
  for (const s of snapshots) {
    const name = s.subject_name ?? "Saved";
    if (!bySubject.has(name)) bySubject.set(name, []);
    bySubject.get(name)!.push(toDrillQuestion(s));
  }
  const questions: DrillQuestion[] = [];
  const subjectTabs: { name: string; start: number }[] = [];
  for (const [name, list] of bySubject) {
    subjectTabs.push({ name, start: questions.length });
    questions.push(...list);
  }
  await saveLocalSession(userId, "practice", {
    questions,
    subjectTabs,
    questionTotal: questions.length,
    sessionLabel: label,
    answers: {},
    marked: [],
    skipped: [],
    revealed: [],
    currentQuestion: 0,
    timeLeft: null,
    startedAtMs: Date.now(),
    attemptId: newId(),
  });
  return questions.length;
}
