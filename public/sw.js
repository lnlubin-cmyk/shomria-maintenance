/*
 * Minimal, safe service worker.
 * - Precaches the offline fallback page + app icons.
 * - Navigations are network-first (always fresh, auth-safe); when offline, the
 *   offline page is shown. Everything else (JS, data, API) passes straight
 *   through to the network — nothing dynamic or authenticated is cached.
 */
const CACHE = "shomria-pwa-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/logo.png", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
