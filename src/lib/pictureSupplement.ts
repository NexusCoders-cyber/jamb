/**
 * Pictures we host ourselves for questions ALOC sends without one.
 *
 * How to add one: save the image under `public/question-images/` (for example `biology-17-2003.png`) and add a line
 * to SUPPLEMENTS with the subject, ALOC's question id and year (both are listed in
 * docs/missing-question-images.md). The question then shows that picture instead of being hidden.
 *
 * Pure (no imports from other app files) so `npm test` can check it.
 */

export type Supplement = {
  /** lower-case subject name as used by the app, e.g. "biology" */
  subject: string;
  /** ALOC's id for the question */
  id: string;
  /** exam year, so an id reused in another year can't pick up the wrong picture */
  year: string;
  /** public path of the image, e.g. "/question-images/biology-17-2003.png" */
  image: string;
};

/** Nothing is listed yet: add real, correct pictures here as they are collected */
export const SUPPLEMENTS: Supplement[] = [];

type Pic = { id?: string | number | null; year?: string | number | null; image?: string | null };

/** Give each question we have a picture for that picture (if ALOC sent none). Other questions pass through untouched. */
export function applySupplements<T extends Pic>(subject: string, list: T[], table: Supplement[] = SUPPLEMENTS): T[] {
  if (table.length === 0) return list;
  const s = subject.trim().toLowerCase();
  return list.map((q) => {
    if (q.image) return q;
    const hit = table.find((t) => t.subject === s && t.id === String(q.id ?? "") && t.year === String(q.year ?? ""));
    return hit ? { ...q, image: hit.image } : q;
  });
}
