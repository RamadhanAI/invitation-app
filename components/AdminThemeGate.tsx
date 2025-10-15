'use client';
import { useEffect } from 'react';

export default function AdminThemeGate() {
  useEffect(() => {
    const saved = (localStorage.getItem('adminTheme') || 'light') as 'light'|'dark';
    const root = document.documentElement;
    if (saved === 'dark') root.classList.add('admin-dark');
  }, []);
  return null;
}
