/* public/service-worker.js */
/* public/service-worker.js */
const VERSION = 'v5'; // bump to break old cache
const ASSET_CACHE = `assets-${VERSION}`;

// Only add files you *actually* have in /public.
// Missing files can make install caching unreliable.
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

const BYPASS_PATHS = [
  /^\/api\/ticket\/png/i,
  /^\/api\/tickets\/png/i,
  /^\/t\/.+\/print/i,
  /^\/api\/scan/i,
  /^\/api\/scanner\//i,
  /^\/api\/register/i,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(ASSET_CACHE);

        // Robust pre-cache: cache each asset individually so one missing file
        // doesn’t break the whole install.
        await Promise.all(
          STATIC_ASSETS.map(async (path) => {
            try {
              const res = await fetch(path, { cache: 'no-store' });
              if (res.ok) await cache.put(path, res);
            } catch {
              // ignore
            }
          })
        );
      } catch {
        // ignore
      }
    })()
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k !== ASSET_CACHE).map((k) => caches.delete(k)));
      } catch {
        // ignore
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const path = url.pathname;

  // 1) Hard bypass for critical dynamic routes
  if (sameOrigin && BYPASS_PATHS.some((rx) => rx.test(path))) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) Navigations + all /api => network-first, fallback to cache if offline
  if (req.mode === 'navigate' || (sameOrigin && path.startsWith('/api/'))) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req, { ignoreSearch: false }))
    );
    return;
  }

  // 3) Cache-first for static assets
  if (sameOrigin && /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?)$/i.test(path)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: false });
        if (hit) return hit;

        const res = await fetch(req);
        try {
          const copy = res.clone();
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(req, copy);
        } catch {
          // ignore
        }
        return res;
      })()
    );
    return;
  }

  // 4) Default: just network
  event.respondWith(fetch(req));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
