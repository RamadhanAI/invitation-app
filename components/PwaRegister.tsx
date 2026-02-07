// components/PwaRegister.tsx
// components/PwaRegister.tsx
'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // ✅ In development: unregister any SW + clear caches (prevents stale HTML hydration mismatch)
    if (process.env.NODE_ENV !== 'production') {
      (async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          // ignore
        }
      })();
      return;
    }

    // ✅ Production only: register SW
    if (!('serviceWorker' in navigator)) return;

    const swUrl = '/service-worker.js';
    navigator.serviceWorker.register(swUrl).catch(() => {
      // swallow
    });
  }, []);

  return null;
}
