// components/AdminThemeToggle.tsx
// app/admin/_components/AdminThemeToggle.tsx
'use client';

import { useEffect, useState } from 'react';

export default function AdminThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const pref = localStorage.getItem('adminTheme');
      if (pref === 'dark') {
        document.getElementById('admin-root')?.classList.add('admin-dark');
        setDark(true);
      }
    } catch {}
  }, []);

  function toggle() {
    const root = document.getElementById('admin-root');
    if (!root) return;
    const next = !root.classList.contains('admin-dark');
    root.classList.toggle('admin-dark', next);
    setDark(next);
    try { localStorage.setItem('adminTheme', next ? 'dark' : 'light'); } catch {}
  }

  return (
    <button type="button" className="a-btn" onClick={toggle}>
      {`Toggle ${dark ? 'Light' : 'Dark'}`}
    </button>
  );
}
