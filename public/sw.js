/**
 * Qubit — Service Worker
 *
 * Strategy:
 *   • App shell (HTML, JS, CSS) → Network-first with cache fallback
 *   • Static assets (fonts, images) → Cache-first
 *   • API calls → Network-only (never cache sensitive data)
 *   • Offline fallback → /offline.html
 */

const CACHE = "qubit-v5";
const OFFLINE_URL = "/offline.html";
// Question pictures fetched through our own /api/image-proxy are kept for offline use ("Download for offline").
// A separate cache so the app-shell cleanup below never throws them away.
const IMAGE_CACHE = "qubit-images-v1";
const IMAGE_CACHE_MAX = 800;

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
      Promise.all(keys.filter((k) => k !== CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)))
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

  // Question pictures via our proxy: cache-first (the picture behind a URL never changes). Works offline once a
  // subject has been downloaded. Everything else under /api/ stays network-only.
  if (url.pathname === "/api/image-proxy") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) {
          await cache.put(request, res.clone());
          const keys = await cache.keys();
          if (keys.length > IMAGE_CACHE_MAX) await Promise.all(keys.slice(0, keys.length - IMAGE_CACHE_MAX).map((k) => cache.delete(k)));
        }
        return res;
      }),
    );
    return;
  }

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

// ── Phone notifications (web push) ───────────────────────────────────────────
// The server sends { title, body, url, tag }. Show it, and open the right page when it is tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = { title: "Qubit", body: event.data ? event.data.text() : "" }; }
  const title = (data && data.title) || "Qubit";
  const options = {
    body: (data && data.body) || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: (data && data.tag) || undefined,   // same tag = replaces an older notification instead of stacking
    renotify: false,
    data: { url: (data && typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications") },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          return c.focus().then((f) => ("navigate" in f ? f.navigate(target) : f)).catch(() => self.clients.openWindow(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
