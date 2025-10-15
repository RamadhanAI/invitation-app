// components/AdminTopNav.tsx
'use client';
import Link from 'next/link';
import AdminThemeToggle from './AdminThemeToggle';

export default function AdminTopBar() {
  return (
    <div className="admin-header">
      <div className="admin-header__left">
        <Link href="/admin/events" className="admin-brand">Demo Organizer</Link>
        <nav className="admin-nav">
          <Link href="/admin/events" className="a-btn a-btn--ghost a-btn--strong">Events</Link>
          <Link href="/scan" className="a-btn a-btn--ghost a-btn--strong">Scanner</Link>
        </nav>
      </div>
      <div className="admin-header__right">
        <Link href="/admin/events/new" className="a-btn btn-cta">New Event</Link>
        <AdminThemeToggle />
      </div>
    </div>
  );
}
