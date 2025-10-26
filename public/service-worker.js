/* public/service-worker.js */
const VERSION = 'v2'; // bump this once now so old cache is nuked
const ASSET_CACHE = `assets-${VERSION}`;
const STATIC_ASSETS = [
  '/',                      // minimal app shell
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE)
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

  // 1. Network-first for API and navigations (SSR pages)
  if (url.pathname.startsWith('/api/') || req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 2. Network-first for JS and CSS so new deploys take effect immediately
  if (
    sameOrigin &&
    /\.(?:js|css)$/i.test(url.pathname)
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // 3. Cache-first for static images/fonts/etc (low-risk stuff)
  if (
    sameOrigin &&
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)
  ) {
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
    return;
  }

  // 4. Fallback: just go to network.
  // (We don't want to accidentally freeze other content in cache forever.)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
