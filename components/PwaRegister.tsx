// components/PwaRegister.tsx
// components/PwaRegister.tsx
'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    // only run in browser and only if SW is supported
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    // basic service worker registration
    const swUrl = '/service-worker.js';
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        // optional feedback hooks
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener(
            'statechange',
            () => {
              // states: installing -> installed -> activating -> activated
              // we could toast "new version available" here if we want
            }
          );
        });
      })
      .catch(() => {
        // swallow in dev / offline
      });
  }, []);

  return null;
}
