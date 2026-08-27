// Service Worker for GoalSync PWA
// Handles caching of app shell so it installs and opens offline.
// NOTE: This does NOT cache Firestore data — that's handled by Firebase's
// own offline persistence (enabled in app.js). This only caches the
// app's own files (HTML/CSS/JS/icons) so the app *shell* loads offline.

const CACHE_NAME = "goalsync-shell-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fall back to network.
// Never intercept Firebase/Firestore/Google requests — let those go
// straight to the network so auth and data sync work correctly.
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // cache a copy of newly fetched app-shell files
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          // if offline and not cached, fall back to index.html for navigation
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});

