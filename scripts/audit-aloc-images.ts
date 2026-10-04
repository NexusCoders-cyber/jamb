/**
 * Audit question images coming from ALOC.
 *
 *   ALOC_API_KEY=xxxx npx tsx scripts/audit-aloc-images.ts [Subject] [count]
 *   (default: Biology, 120 questions)
 *
 * For every question that carries a picture it prints where the picture sits (question / option /
 * passage / explanation), the URL the app resolved, and whether that URL really answers with an image
 * (HTTP status + content type). Anything that fails is listed at the end together with the direct and
 * proxied results — use it to see WHICH hosts or URL shapes break so they can be handled in
 * resolveImageUrl() in src/lib/aloc.ts.
 */
import { fetchAlocQuestionCount, type NormalizedQuestion } from "../src/lib/aloc";

const subject = process.argv[2] ?? "Biology";
const count = Math.max(1, Math.min(200, Number(process.argv[3] ?? 120)));
const apiKey = process.env.ALOC_API_KEY;

type Ref = { qid: string; where: string; url: string };

function collect(q: NormalizedQuestion): Ref[] {
  const out: Ref[] = [];
  for (const u of q.images ?? (q.image ? [q.image] : [])) out.push({ qid: q.id, where: "question", url: u });
  (q.optionImages ?? []).forEach((u, i) => u && out.push({ qid: q.id, where: `option ${"ABCDE"[i] ?? i + 1}`, url: u }));
  for (const u of q.sectionImages ?? []) out.push({ qid: q.id, where: "passage", url: u });
  for (const u of q.explanationImages ?? []) out.push({ qid: q.id, where: "explanation", url: u });
  return out;
}

async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  if (url.startsWith("data:")) {
    return { ok: /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/i.test(url) || /^data:image\/svg\+xml/i.test(url), detail: `data URI (${url.length} chars)` };
  }
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(12000), headers: { "user-agent": "Mozilla/5.0 (image audit)" } });
    const type = res.headers.get("content-type") ?? "";
    return { ok: res.ok && /^image\//i.test(type), detail: `HTTP ${res.status} ${type || "(no content-type)"}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  if (!apiKey) {
    console.error("Set ALOC_API_KEY first, e.g.  ALOC_API_KEY=xxxx npx tsx scripts/audit-aloc-images.ts Biology 120");
    process.exit(1);
  }
  console.log(`Fetching ${count} ${subject} questions…`);
  const questions = await fetchAlocQuestionCount(apiKey, subject, count, { type: "utme" });
  const refs = questions.flatMap(collect);
  console.log(`${questions.length} questions, ${questions.filter((q) => collect(q).length > 0).length} with pictures, ${refs.length} picture references\n`);

  const failures: (Ref & { detail: string })[] = [];
  for (const ref of refs) {
    const r = await probe(ref.url);
    console.log(`${r.ok ? "OK  " : "FAIL"} ${ref.qid} [${ref.where}] ${ref.url.slice(0, 110)}  →  ${r.detail}`);
    if (!r.ok) failures.push({ ...ref, detail: r.detail });
  }

  console.log(`\n${refs.length - failures.length}/${refs.length} pictures load directly.`);
  if (failures.length > 0) {
    console.log("\nFailing pictures (the app retries these through /api/image-proxy):");
    const hosts = new Map<string, number>();
    for (const f of failures) {
      let host = "(not a URL)";
      try { host = new URL(f.url).host; } catch { /* keep default */ }
      hosts.set(host, (hosts.get(host) ?? 0) + 1);
      console.log(`  ${f.qid} [${f.where}] ${f.url}\n      ${f.detail}`);
    }
    console.log("\nBy host:", Object.fromEntries(hosts));
  }
}

void main();
