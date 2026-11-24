const CACHE_NAME = "littlesteps-offline-v1";
const CORE_SHELL_ASSETS = [
  "/",
  "/kids",
  "/manifest.webmanifest",
  "/images/littlesteps-logo.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_SHELL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated user/session tokens or admin endpoints
  if (
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/api/admin/") ||
    url.pathname.startsWith("/api/teacher/")
  ) {
    return;
  }

  // Static animal sounds & images: cache-first for prepaid mobile data savings
  if (url.pathname.startsWith("/sounds/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Curriculum JSON (subjects, themes, lessons, games): stale-while-revalidate
  if (
    url.pathname === "/api/subjects" ||
    url.pathname === "/api/themes" ||
    url.pathname.startsWith("/api/lessons") ||
    url.pathname.startsWith("/api/games")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
