// public/service-worker.js
/* public/service-worker.js */
const VERSION = 'v1';
const ASSET_CACHE = `assets-${VERSION}`;
const STATIC_ASSETS = [
  '/',                      // app shell (kept minimal)
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Network-first for API and navigations to keep SSR fresh
  if (url.pathname.startsWith('/api/') || req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for same-origin static assets (png/jpg/svg/css/js/fonts)
  if (sameOrigin && /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        });
      })
    );
  }
});
