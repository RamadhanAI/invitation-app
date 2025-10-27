/* public/service-worker.js */
const VERSION = 'v3'; // <- bump this to break old cache
const ASSET_CACHE = `assets-${VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(ASSET_CACHE)
      .then((c) => c.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Always network-first for API calls and navigations,
  // so admin auth state and fresh JS isn't stale.
  if (url.pathname.startsWith('/api/') || req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first for static assets (icons, css, js chunks, etc.)
  if (
    sameOrigin &&
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/i.test(
      url.pathname
    )
  ) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches
            .open(ASSET_CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
          return res;
        });
      })
    );
  }
});
