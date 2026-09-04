// Service Worker for GoalSync PWA
// v3 — icon pre-caching is now resilient: previously, cache.addAll()
// would fail COMPLETELY if even one icon file was missing/renamed,
// which meant the whole service worker failed to install — and a
// working service worker is required for "Add to Home Screen" to be
// offered at all. Now each icon is fetched independently, so one bad
// file can't take down installability for the whole app.

const CACHE_NAME = "goalsync-shell-v9";

const APP_SHELL = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png"
];

async function precacheAppShell(cache) {
  await Promise.all(
    APP_SHELL.map((url) =>
      cache.add(url).catch((err) => {
        console.warn("Could not precache (will still work, just uncached):", url, err);
      })
    )
  );
}

// Install: pre-cache the rarely-changing assets (icons)
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(precacheAppShell));
  self.skipWaiting();
});

// Activate: delete ALL old caches (including previous versions) so
// stale HTML/JS can never be served again
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => caches.open(CACHE_NAME).then(precacheAppShell))
  );
  self.clients.claim();
});

// Fetch strategy:
// - Firebase/Google requests: never intercept, let them go straight through
// - HTML/JS/CSS (the app shell): NETWORK-FIRST, fall back to cache only if offline
// - Everything else (icons, images): cache-first
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  const isFirebaseOrGoogle =
    url.includes("firebaseio.com") ||
    url.includes("googleapis.com") ||
    url.includes("google.com") ||
    url.includes("gstatic.com");

  if (isFirebaseOrGoogle || event.request.method !== "GET") {
    return; // let the browser handle it normally
  }

  const isAppShellFile =
    event.request.mode === "navigate" ||
    url.endsWith(".html") ||
    url.endsWith(".js") ||
    url.endsWith(".css") ||
    url.endsWith("/");

  if (isAppShellFile) {
    // NETWORK-FIRST: always try to get the freshest code.
    // Only fall back to cache if there's truly no internet.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // CACHE-FIRST for static assets like icons
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
