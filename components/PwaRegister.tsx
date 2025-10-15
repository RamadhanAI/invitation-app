// components/PwaRegister.tsx
// components/PwaRegister.tsx
'use client';
import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const swUrl = '/service-worker.js';
    navigator.serviceWorker.register(swUrl).then((reg) => {
      // Optional: listen for updates without disrupting UX
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          // states: installing -> installed -> activating -> activated
          // We could notify the user here if you want a “New version available” toast.
        });
      });
    }).catch(() => {
      // no-op in dev
    });
  }, []);

  return null;
}
