// app/admin/AdminShell.tsx  (Client)
// app/admin/AdminShell.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const pref = localStorage.getItem('adminTheme');
      if (pref === 'dark') setDark(true);
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.getElementById('admin-root');
    if (!root) return;
    root.classList.toggle('admin-dark', dark);
    try { localStorage.setItem('adminTheme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  return (
    <div id="admin-root" className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__left">
          <Link href="/admin/events" className="admin-brand">Admin</Link>
          <nav className="admin-nav">
            <Link href="/admin/events" className="a-btn a-btn--strong">Events</Link>
            <Link href="/scan" className="a-btn a-btn--strong">Scanner</Link>
            <a href="/api/admin/events" className="a-btn a-btn--strong" title="Raw events API">API</a>
          </nav>
        </div>
        <div className="admin-header__right">
          <Link href="/admin/events/new" className="a-btn a-btn--primary">New Event</Link>
          <button
            type="button"
            className="a-btn a-btn--strong"
            onClick={() => setDark((v) => !v)}
          >
            {mounted ? (dark ? 'Light mode' : 'Dark mode') : '…'}
          </button>
        </div>
      </header>

      {/* FULL-WIDTH main (no container caps) */}
      <main className="admin-main">{children}</main>
    </div>
  );
}
