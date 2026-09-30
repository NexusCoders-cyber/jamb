/**
 * JAMB-style English paper builder.
 *
 * Why this exists: ALOC stores English as a flat table. Comprehension / cloze
 * questions carry their passage in `section` and are flagged `hasPassage`, but
 * the /m and /q/{n} endpoints DROP them unless `withComprehension=true` is sent,
 * and they come back in random order. A real JAMB paper is the opposite: whole
 * passages with all their questions together, a handful of set-text (novel)
 * questions, then lexis/structure and oral forms.
 *
 * `buildEnglishPaper` is pure (no network) so it can be tested with fake data.
 * `assembleEnglishPaper` does the ALOC calls and then calls the builder.
 */
import {
  fetchAlocComprehensionYears,
  fetchAlocMany,
  novelMatches,
  type NormalizedQuestion,
} from "./aloc";

/** Section order of the assembled paper. Change here if you want a different order. */
export const ENGLISH_PAPER_ORDER = ["passages", "lexis", "oral", "novel"] as const;

export type EnglishPaperOptions = {
  /** Questions in the paper (JAMB Use of English = 60) */
  total?: number;
  /** Set-text (novel) questions: at least this many … */
  novelMin?: number;
  /** … and at most this many (inclusive). Defaults keep it between 5 and 9. */
  novelMax?: number;
  /** How many passages to show (JAMB sets 2: a comprehension + a cloze) */
  maxPassages?: number;
  /** Cap per passage so one passage cannot swallow the paper */
  perPassageMax?: number;
  /** Oral-forms questions in the paper (JAMB syllabus: 10) */
  oralTarget?: number;
  /** The current official set text; preferred when enough questions exist */
  preferredNovel?: string;
  rng?: () => number;
};

export type EnglishPaperMeta = {
  total: number;
  passages: { passageNo: number; questions: number; year: string | null }[];
  passageQuestions: number;
  novel: { title: string | null; questions: number };
  lexis: number;
  oral: number;
  /** Set when the paper came out shorter than requested (pool too small) */
  shortBy: number;
};

function shuffle<T>(list: T[], rng: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ORAL_HINT =
  /\boral\b|\bstress\b|\brhym|\bvowel|\bconsonant|\bphonem|\bpronunc|\bemphatic|\bintonation|\bsound\b.*\b(?:same|different|underlined)|underlined.*\bsound|\/[^\s/]{1,8}\//i;

function isOral(q: NormalizedQuestion): boolean {
  if (q.category && /oral|phonet|stress|sound/i.test(q.category)) return true;
  return ORAL_HINT.test(`${q.prompt} ${q.section ?? ""}`);
}

function isNovel(q: NormalizedQuestion): boolean {
  if (q.novel) return true;
  return !!q.category && /novel|reading text|set text|literary/i.test(q.category);
}

function byNub(a: NormalizedQuestion, b: NormalizedQuestion): number {
  const an = a.questionNub ?? Number.MAX_SAFE_INTEGER;
  const bn = b.questionNub ?? Number.MAX_SAFE_INTEGER;
  if (an !== bn) return an - bn;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

export function buildEnglishPaper(
  pool: NormalizedQuestion[],
  options: EnglishPaperOptions = {},
): { questions: NormalizedQuestion[]; meta: EnglishPaperMeta } {
  const rng = options.rng ?? Math.random;
  const total = options.total ?? 60;
  const novelMin = options.novelMin ?? 5;
  const novelMax = Math.max(novelMin, options.novelMax ?? 9);
  const maxPassages = options.maxPassages ?? 2;
  const perPassageMax = options.perPassageMax ?? 10;
  const oralTargetWanted = options.oralTarget ?? 10;
  const preferredNovel = options.preferredNovel ?? "The Lekki Headmaster";

  // 1. de-duplicate
  const seen = new Set<string>();
  const all = pool.filter((q) => {
    const id = String(q.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // 2. novel bucket — ONE set text per paper, like JAMB
  const novelAll = all.filter(isNovel);
  const titleGroups = new Map<string, NormalizedQuestion[]>();
  for (const q of novelAll) {
    const title = q.novel ?? "Set text";
    const key = Array.from(titleGroups.keys()).find((k) => novelMatches(k, title)) ?? title;
    titleGroups.set(key, [...(titleGroups.get(key) ?? []), q]);
  }
  let novelTitle: string | null = null;
  let novelCandidates: NormalizedQuestion[] = [];
  if (titleGroups.size > 0) {
    const entries = Array.from(titleGroups.entries());
    const preferred = entries.find(([k, v]) => novelMatches(k, preferredNovel) && v.length >= novelMin);
    const best = preferred ?? entries.sort((a, b) => b[1].length - a[1].length)[0];
    novelTitle = best[0] === "Set text" ? null : best[0];
    novelCandidates = best[1];
  }
  const novelWanted = novelMin + Math.floor(rng() * (novelMax - novelMin + 1));
  const novelPicked = shuffle(novelCandidates, rng).slice(0, Math.min(novelWanted, total));
  const novelIds = new Set(novelAll.map((q) => String(q.id)));

  // 3. passages — every passage keeps ALL its questions together, in paper order
  const passageAll = all.filter((q) => !novelIds.has(String(q.id)) && q.passageId);
  const groups = new Map<string, NormalizedQuestion[]>();
  for (const q of passageAll) groups.set(q.passageId!, [...(groups.get(q.passageId!) ?? []), q]);
  const ranked = Array.from(groups.values()).sort((a, b) => b.length - a.length);
  // Prefer passages with a proper set of questions; a lone stray question is usually
  // an incomplete pull and would make a poor "passage".
  const solid = ranked.filter((g) => g.length >= 3);
  const chosenGroups = shuffle((solid.length > 0 ? solid : ranked).slice(0, Math.max(maxPassages * 2, maxPassages)), rng)
    .slice(0, maxPassages)
    .map((g) => g.slice().sort(byNub).slice(0, perPassageMax));
  const passageQs: NormalizedQuestion[] = [];
  const passageMeta: EnglishPaperMeta["passages"] = [];
  chosenGroups.forEach((g, i) => {
    const room = Math.max(0, total - novelPicked.length - passageQs.length);
    const take = g.slice(0, room);
    take.forEach((q) => passageQs.push({ ...q, passageNo: i + 1 }));
    if (take.length > 0) passageMeta.push({ passageNo: i + 1, questions: take.length, year: take[0].year ?? null });
  });
  const passageIdsAll = new Set(passageAll.map((q) => String(q.id)));

  // 4. lexis / oral fill (never orphan passage questions, never extra novel questions)
  const rest = all.filter((q) => !novelIds.has(String(q.id)) && !passageIdsAll.has(String(q.id)));
  const remaining = Math.max(0, total - novelPicked.length - passageQs.length);
  const oralPool = shuffle(rest.filter(isOral), rng);
  const lexisPool = shuffle(rest.filter((q) => !isOral(q)), rng);
  const oralCount = Math.min(oralTargetWanted, oralPool.length, remaining);
  const lexisCount = Math.min(remaining - oralCount, lexisPool.length);
  // if lexis ran short, let oral fill the gap rather than ship a short paper
  const oralExtra = Math.min(remaining - oralCount - lexisCount, oralPool.length - oralCount);
  const oralQs = oralPool.slice(0, oralCount + Math.max(0, oralExtra));
  const lexisQs = lexisPool.slice(0, lexisCount);

  // 5. assemble in JAMB order
  const sections: Record<(typeof ENGLISH_PAPER_ORDER)[number], NormalizedQuestion[]> = {
    passages: passageQs,
    lexis: lexisQs,
    oral: oralQs,
    novel: novelPicked,
  };
  const questions = ENGLISH_PAPER_ORDER.flatMap((k) => sections[k]);

  return {
    questions,
    meta: {
      total: questions.length,
      passages: passageMeta,
      passageQuestions: passageQs.length,
      novel: { title: novelTitle, questions: novelPicked.length },
      lexis: lexisQs.length,
      oral: oralQs.length,
      shortBy: Math.max(0, total - questions.length),
    },
  };
}

/**
 * Talk to ALOC and build one paper.
 *  • picks a year that really has comprehension passages (the requested one if it does)
 *  • pulls that whole year with withComprehension=true so passages arrive complete
 *  • pulls a general (all-years, no-passage) pool for lexis / oral / novel fill
 */
export async function assembleEnglishPaper(
  apiKey: string,
  opts: { year?: string; type?: string } & EnglishPaperOptions = {},
): Promise<{ questions: NormalizedQuestion[]; meta: EnglishPaperMeta & { year: string | null; usedFallbackYear: boolean } }> {
  const rng = opts.rng ?? Math.random;
  const type = opts.type ?? "utme";
  const requested = opts.year && opts.year !== "random" && opts.year !== "All years" ? opts.year : undefined;

  const compYears = await fetchAlocComprehensionYears(apiKey).catch(() => [] as string[]);
  const tryYears: (string | undefined)[] = [];
  if (requested) tryYears.push(requested);
  for (const y of shuffle(compYears.filter((y) => y !== requested), rng)) tryYears.push(y);
  if (tryYears.length === 0) tryYears.push(undefined);

  // general pool (lexis / oral / novel) runs in parallel with the passage search.
  // If filtering by exam type comes back thin, top up without the type filter.
  const generalPromise = (async () => {
    const typed = await fetchAlocMany(apiKey, "english", 120, { type, withComprehension: false }).catch(
      () => [] as NormalizedQuestion[],
    );
    if (typed.length >= 40) return typed;
    const any = await fetchAlocMany(apiKey, "english", 120, { withComprehension: false }).catch(
      () => [] as NormalizedQuestion[],
    );
    return [...typed, ...any];
  })();

  let yearPool: NormalizedQuestion[] = [];
  let usedYear: string | null = null;
  // at most 4 ALOC calls while hunting for a year whose passages come back complete
  const attempts: { y: string | undefined; t: string | undefined }[] = [];
  for (const y of tryYears.slice(0, 3)) {
    attempts.push({ y, t: type });
    if (y === tryYears[0]) attempts.push({ y, t: undefined });
  }
  for (const { y, t } of attempts.slice(0, 4)) {
    const pulled = await fetchAlocMany(apiKey, "english", 120, { year: y, type: t, withComprehension: true }).catch(
      () => [] as NormalizedQuestion[],
    );
    const withPassage = pulled.filter((q) => q.passageId).length;
    if (withPassage >= 3) {
      yearPool = pulled;
      usedYear = y ?? null;
      break;
    }
    if (yearPool.length === 0) yearPool = pulled;
  }
  const general = await generalPromise;

  const { questions, meta } = buildEnglishPaper([...yearPool, ...general], opts);
  return {
    questions,
    meta: { ...meta, year: usedYear, usedFallbackYear: !!requested && usedYear !== requested },
  };
}
