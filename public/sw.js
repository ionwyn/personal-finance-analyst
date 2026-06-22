const CACHE_NAME = "wyn-pwa-v2";
const OFFLINE_URL = "/offline";
const CORE_ASSETS = [
  OFFLINE_URL,
  "/icons/wyn-icon-192.png",
  "/icons/wyn-icon-512.png",
  "/icons/wyn-maskable-192.png",
  "/icons/wyn-maskable-512.png",
  "/icons/wyn-apple-touch-icon.png",
  "/icons/wyn-notification-badge.png",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/image/") ||
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/signin") ||
    (url.pathname.startsWith("/icons/") === false && url.pathname.startsWith("/_next/"))
  );
}

function isPwaAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.ico"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("wyn-pwa-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url) || isNeverCached(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      })
    );
    return;
  }

  if (isPwaAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
