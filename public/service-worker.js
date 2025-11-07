/* public/service-worker.js */
/* public/service-worker.js */
const VERSION = 'v4'; // bump to break old cache
const ASSET_CACHE = `assets-${VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// Paths we NEVER cache (critical dynamic stuff)
const BYPASS_PATHS = [
  /^\/api\/ticket\/png/i,     // badge PNG (singular)
  /^\/api\/tickets\/png/i,    // badge PNG (plural route if present)
  /^\/t\/.+\/print/i,         // print sheet
  /^\/api\/scan/i,            // scanning
  /^\/api\/scanner\//i,       // scanner session/checkin
  /^\/api\/register/i,        // registration
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
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const path = url.pathname;

  // 1) Hard bypass for critical dynamic routes (no cache, no fallback)
  if (sameOrigin && BYPASS_PATHS.some((rx) => rx.test(path))) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) Navigations and the rest of /api are network-first
  if (req.mode === 'navigate' || (sameOrigin && path.startsWith('/api/'))) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req, { ignoreSearch: false }))
    );
    return;
  }

  // 3) Cache-first for static assets (icons, css, js, fonts, images)
  if (
    sameOrigin &&
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/i.test(path)
  ) {
    event.respondWith(
      caches.match(req, { ignoreSearch: false }).then((hit) => {
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

// Optional: allow immediate activation when you postMessage('SKIP_WAITING')
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
