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

/** Pictures we host. Add a line for each new one (see docs/missing-question-images.md). */
export const SUPPLEMENTS: Supplement[] = [
  // Nerve cell (neuron): two questions share one diagram
  { subject: "biology", id: "16", year: "2003", image: "/question-images/biology-neuron.png" },
  { subject: "biology", id: "17", year: "2003", image: "/question-images/biology-neuron.png" },
  // Giraffe ancestors → new generation: two questions share one diagram
  { subject: "biology", id: "145", year: "2006", image: "/question-images/biology-giraffes.png" },
  { subject: "biology", id: "146", year: "2006", image: "/question-images/biology-giraffes.png" },
  // Single-celled organism with parts I–IV
  { subject: "biology", id: "156", year: "2007", image: "/question-images/biology-paramecium.png" },
  // Contour map (a knoll)
  { subject: "geography", id: "257", year: "2016", image: "/question-images/geography-contour-knoll.png" },
  // Pie chart of 36 students' grades
  { subject: "mathematics", id: "371", year: "2005", image: "/question-images/mathematics-pie-grades.png" },
];

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
