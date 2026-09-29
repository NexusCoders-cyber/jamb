/**
 * Quick verification of the new aloc.ts parsing helpers against live ALOC data.
 * Run: npx tsx scripts/verify-aloc.ts  (dev-only, delete after use)
 */
import { readFileSync } from "node:fs";
import { htmlToSegments, classifySection, detectNovel } from "../src/lib/aloc";

const env = readFileSync(".env.local", "utf8");
const m = env.match(/ALOC_API_KEY\s*=\s*(.+)/);
const key = m ? m[1].trim().replace(/^Bearer\s+/i, "") : "";
const headers = { Accept: "application/json", AccessToken: key, Authorization: `Bearer ${key}` };
const base = "https://questions.aloc.com.ng/api/v2";

// 1. Italics preservation
const segs = htmlToSegments("The company director has a <i>vivacious</i> personality.");
console.log("1. italics:", JSON.stringify(segs));
console.log("   plain:", segs.map((s) => s.text).join(""));

// 2. Novel detection
console.log("2. novel (lit):", detectNovel("Based on George Orwell\u2019s \tNineteen Eighty-Four."));
console.log("   novel (eng):", detectNovel("This question is based on Bolaji Abdullahi's Sweet Sixteen"));
console.log("   novel (none):", detectNovel("choose the option nearest in meaning"));

// 3. Passage vs instruction
console.log("3. long prose:", classifySection("In each of the following sentences, the word that receives the emphatic stress is written in capital letters. From the options lettered A to D, choose the appropriate answer."));
console.log("   short:", classifySection("choose the option nearest in meaning to the word capitalized"));

// 4. Live sample — check italic + novel + section across a real English batch
async function sample(url: string, label: string, n = 25) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const json = (await res.json()) as { data?: Array<{ question: string; section?: string; image?: string }> };
  const list = Array.isArray(json.data) ? json.data : [];
  const withItalics = list.filter((q) => /<i>|<em>/i.test(q.question ?? "")).length;
  const novels = new Set(
    list.map((q) => detectNovel(q.section ?? "")).filter((t): t is string => t !== null),
  );
  const passages = list.filter((q) => classifySection(q.section ?? null) === "passage").length;
  const withImg = list.filter((q) => (q.image ?? "").trim().length > 0).length;
  console.log(`\n${label}: ${list.length} qs | italics: ${withItalics} | novels: [${[...novels].join(", ") || "none"}] | passages: ${passages} | images: ${withImg}`);
}

async function main() {
  await sample(`${base}/m?subject=english&t=${Date.now()}`, "LIVE english batch");
  await sample(`${base}/m?subject=englishlit&t=${Date.now()}`, "LIVE englishlit batch");
}
void main();
