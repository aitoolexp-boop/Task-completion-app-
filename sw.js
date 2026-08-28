// Service Worker for GoalSync PWA
// v2 — switched to NETWORK-FIRST for app shell files so updates show up
// immediately instead of being stuck on old cached code. Icons still
// cache normally since they rarely change.

const CACHE_NAME = "goalsync-shell-v4";

const APP_SHELL = [
  "/icon-192.png",
  "/icon-512.png"
];

// Install: pre-cache only the rarely-changing assets (icons)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches (including previous versions) so
// stale HTML/JS can never be served again
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
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
