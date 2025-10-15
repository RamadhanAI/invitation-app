'use client';
import { useEffect } from 'react';

export default function ThemeBoot() {
  useEffect(() => {
    try {
      const saved = (typeof window !== 'undefined' && localStorage.getItem('adminTheme')) || 'light';
      const host = document.getElementById('admin-root') || document.documentElement;
      host.classList.toggle('admin-dark', saved === 'dark');
    } catch {}
  }, []);
  return null;
}
