// components/AdminTopBar.tsx
'use client';

import Link from 'next/link';
import AdminThemeToggle from './AdminThemeToggle';

export default function AdminTopBar() {
  return (
    <div className="admin-header">
      <div className="admin-header__left">
        <Link href="/admin" className="admin-brand">
          AurumPass <span style={{ opacity: 0.8, fontWeight: 600 }}>Admin</span>
        </Link>

        <span className="badge" style={{ marginLeft: 6 }}>
          Control Room
        </span>

        <nav className="admin-nav" style={{ display: 'flex', gap: 8, marginLeft: 10 }}>
          <Link href="/admin/events" className="a-btn a-btn--ghost a-btn--strong">
            Events
          </Link>
          <Link href="/scan" className="a-btn a-btn--ghost a-btn--strong">
            Scanner
          </Link>
          <Link href="/admin/theme" className="a-btn a-btn--ghost a-btn--strong">
            Branding
          </Link>
        </nav>
      </div>

      <div className="admin-header__right">
        <Link href="/admin/events/new" className="a-btn btn-cta">
          New Event
        </Link>
        <AdminThemeToggle />
      </div>
    </div>
  );
}
