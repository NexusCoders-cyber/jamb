"use client";

/**
 * Loads question pictures BEFORE the question is on screen, and remembers how each one loads.
 *
 *  • "direct" — the browser can fetch the original address
 *  • "proxy"  — the original failed (http-only host, hot-link block …) so it goes through /api/image-proxy
 *  • "failed" — neither worked
 *
 * Once a picture has been checked it sits in the browser cache, so when its question appears it is simply
 * there — no blank box, no retry flash. QuestionImage reads the remembered route to pick the right address first time.
 */

export type ImageRoute = "direct" | "proxy" | "failed";

const routes = new Map<string, ImageRoute>();
const inflight = new Map<string, Promise<ImageRoute>>();

export function proxiedUrl(src: string): string {
  return `/api/image-proxy?u=${encodeURIComponent(src)}`;
}

/** What is already known about this picture (undefined = not checked yet). */
export function knownRoute(src: string): ImageRoute | undefined {
  if (src.startsWith("data:") || src.startsWith("blob:")) return "direct";
  return routes.get(src);
}

function tryLoad(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    const img = new window.Image();
    img.referrerPolicy = "no-referrer";
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = url;
    // Already in the browser cache: the load event may have fired before the handlers were attached
    if (img.complete && img.naturalWidth > 0) finish(true);
  });
}

/** Check (and warm the cache for) one picture. Safe to call repeatedly: work is shared. */
export function preloadImage(src: string): Promise<ImageRoute> {
  const known = knownRoute(src);
  if (known) return Promise.resolve(known);
  const running = inflight.get(src);
  if (running) return running;

  const job = (async (): Promise<ImageRoute> => {
    let route: ImageRoute = "failed";
    if (await tryLoad(src, 12000)) route = "direct";
    else if (/^https?:\/\//i.test(src) && (await tryLoad(proxiedUrl(src), 15000))) route = "proxy";
    // A failure is not remembered for long: the host or the connection may recover
    if (route === "failed") window.setTimeout(() => routes.delete(src), 30000);
    routes.set(src, route);
    inflight.delete(src);
    return route;
  })();
  inflight.set(src, job);
  return job;
}

/** Preload a list in order, a few at a time. Resolves when every picture has been checked. */
export async function preloadImages(srcs: string[], concurrency = 3): Promise<void> {
  const queue = Array.from(new Set(srcs.filter(Boolean)));
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let src = queue.shift(); src !== undefined; src = queue.shift()) {
      await preloadImage(src);
    }
  });
  await Promise.all(workers);
}
