"use client";

/**
 * "Download for offline": fills the device's question pool for a subject (several batches from many years) and
 * saves the pictures those questions use, so a student can practise with no data at all.
 *
 * Questions go into the same IndexedDB pool the exam page already reads when offline. Pictures are requested
 * through /api/image-proxy, which the service worker keeps in its own cache (see public/sw.js).
 */
import { cacheKey } from "./questionCache";
import { getMeta, setMeta } from "./localDb";
import { addToPool } from "./questionPool";
import { proxiedUrl } from "./imagePreload";
import { deviceHeaders } from "./device";

export type PackInfo = { at: string; questions: number; images: number; imagesFailed: number };
export type PackProgress = { phase: "questions" | "images"; done: number; total: number };

const BATCHES = 4; // ×200 questions, spread across years
const MAX_IMAGES = 150;
const IMAGE_GAP_MS = 350; // stays under the image proxy's 240-requests-a-minute limit

const metaKey = (subject: string) => `offlinePack:${subject.toLowerCase().trim()}`;

export async function getPackInfo(subject: string): Promise<PackInfo | null> {
  return (await getMeta<PackInfo>(metaKey(subject))) ?? null;
}

type Q = {
  id: string | number;
  image?: string | null;
  images?: string[];
  optionImages?: (string | null)[];
  sectionImages?: string[];
};

export function imagesOfQuestion(q: Q): string[] {
  const all = [q.image, ...(q.images ?? []), ...(q.optionImages ?? []), ...(q.sectionImages ?? [])];
  return all.filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function downloadPack(
  subject: string,
  onProgress: (p: PackProgress) => void,
  signal?: { cancelled: boolean },
): Promise<PackInfo> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Connect to the internet to download.");

  // 1. questions — several random-year batches, merged into the device pool
  const key = cacheKey(subject);
  const all: Q[] = [];
  let poolSize = 0;
  let lastError: unknown = null;
  for (let i = 0; i < BATCHES; i++) {
    if (signal?.cancelled) break;
    onProgress({ phase: "questions", done: i, total: BATCHES });
    try {
      const res = (await fetch(
        `/api/aloc?endpoint=questions&subject=${encodeURIComponent(subject)}&type=utme&count=200&spread=1&t=${Date.now()}-${i}`,
        { headers: await deviceHeaders() },
      ).then((r) => r.json())) as { ok: boolean; data?: Q[]; error?: string };
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        all.push(...res.data);
        poolSize = await addToPool(key, res.data);
      } else {
        lastError = new Error(res.error ?? "No questions returned");
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (poolSize === 0) throw lastError instanceof Error ? lastError : new Error("Could not download questions right now.");
  onProgress({ phase: "questions", done: BATCHES, total: BATCHES });

  // 2. pictures — one at a time, politely
  const urls = Array.from(new Set(all.flatMap(imagesOfQuestion))).slice(0, MAX_IMAGES);
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    if (signal?.cancelled) break;
    onProgress({ phase: "images", done: i, total: urls.length });
    let saved = false;
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      try {
        const res = await fetch(proxiedUrl(urls[i]));
        if (res.ok) {
          await res.arrayBuffer(); // read it fully so the service worker finishes caching it
          saved = true;
        } else if (res.status === 429) {
          await sleep(2500);
        } else break;
      } catch {
        break;
      }
    }
    if (saved) ok++;
    else failed++;
    await sleep(IMAGE_GAP_MS);
  }
  onProgress({ phase: "images", done: urls.length, total: urls.length });

  const info: PackInfo = { at: new Date().toISOString(), questions: poolSize, images: ok, imagesFailed: failed };
  await setMeta(metaKey(subject), info);
  return info;
}
