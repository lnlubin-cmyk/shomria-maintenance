/*
 * Service worker for the Shomria PWA.
 *
 * Goals: keep authenticated pages always-fresh, but make a cold reload cheap —
 * on phones that kill the app in the background (e.g. Xiaomi/MIUI), returning to
 * the app re-loads everything, and without caching that means re-downloading the
 * whole map (the govmap SDK + every tile) over mobile data each time. The map of
 * the kibbutz is identical every visit, so we cache those aggressively.
 *
 * Strategy:
 *   - Navigations (HTML): network-first, offline page as fallback. Never cached
 *     (they are authenticated / dynamic).
 *   - Same-origin static build assets (JS/CSS/fonts/images): cache-first.
 *   - govmap SDK script: stale-while-revalidate.
 *   - govmap tiles/assets: cache-first, in a size-bounded cache.
 *   - Everything else (Supabase API, auth, uploads): straight to network.
 */
const VERSION = "v4";
const PRECACHE_NAME = `shomria-precache-${VERSION}`;
const STATIC_NAME = `shomria-static-${VERSION}`;
const MAP_NAME = `shomria-map-${VERSION}`;
const CURRENT = [PRECACHE_NAME, STATIC_NAME, MAP_NAME];

const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/logo.png", "/icons/icon-192.png"];

const STATIC_MAX = 120; // hashed build assets
const MAP_MAX = 400; // govmap tiles + SDK

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE_NAME).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Keep a cache from growing without bound: drop the oldest entries (insertion
// order) once it exceeds `max`.
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const key of keys.slice(0, keys.length - max)) await cache.delete(key);
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Cache successful same-origin responses and opaque cross-origin ones (tiles),
  // but never an explicit error we can read.
  if (res && (res.ok || res.type === "opaque")) {
    cache.put(req, res.clone());
    trim(cacheName, max);
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) {
        cache.put(req, res.clone());
        trim(cacheName, max);
      }
      return res;
    })
    .catch(() => null);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isGovmap = url.hostname.includes("govmap");

  // Authenticated HTML — always fresh, offline page when unreachable.
  if (req.mode === "navigate") {
    // The "open file" routes 307-redirect to a signed URL. Let the browser
    // handle those navigations itself: a service-worker-returned redirect blanks
    // the page (black screen) on some Android browsers. Bypassing = don't call
    // respondWith, so the browser follows the redirect natively.
    if (url.pathname.endsWith("/file")) return;
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable build assets — safe to serve from cache first.
  if (
    sameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      ["style", "script", "font", "image"].includes(req.destination))
  ) {
    event.respondWith(cacheFirst(req, STATIC_NAME, STATIC_MAX));
    return;
  }

  // govmap: SDK script (changes occasionally) vs tiles/assets (stable).
  if (isGovmap) {
    if (url.pathname.endsWith(".js")) {
      event.respondWith(staleWhileRevalidate(req, MAP_NAME, MAP_MAX));
    } else {
      event.respondWith(cacheFirst(req, MAP_NAME, MAP_MAX));
    }
    return;
  }

  // Everything else (Supabase, auth, uploads): straight to the network.
});
