/**
 * Qubit — Service Worker
 *
 * Strategy:
 *   • App shell (HTML, JS, CSS) → Network-first with cache fallback
 *   • Static assets (fonts, images) → Cache-first
 *   • API calls → Network-only (never cache sensitive data)
 *   • Offline fallback → /offline.html
 */

const CACHE = "qubit-v4";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  "/",
  "/dashboard",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
];

// Install — precache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    // cache.addAll is all-or-nothing: one missing/redirecting URL used to abort the whole install,
    // leaving the app with no offline support. Cache each entry on its own instead.
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser-extension requests
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // Only this site's own files are handled here. Pictures from other hosts (question diagrams on Cloudinary
  // etc.) must go straight from the browser to the host: the site's security policy blocks the service
  // worker from fetching them, which used to make every question image fail to display.
  if (url.origin !== self.location.origin) return;

  // API calls — always network, never cache
  if (url.pathname.startsWith("/api/")) return;

  // Supabase / external APIs — network only
  if (url.hostname.includes("supabase.co") || url.hostname.includes("paystack.co")) return;

  // Static assets — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Navigation (HTML pages) — network-first, fall back to cache, then offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached ?? caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }
});
