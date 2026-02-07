// app/admin/AdminShell.tsx
// app/admin/AdminShell.tsx
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

type AdminSess = {
  ok?: boolean;
  role?: string;
  oid?: string | null;
  user?: string | null;
  imp?: boolean;
  impTenantName?: string | null;
  impTenantStatus?: string | null;
};

function isSuperadmin(sess: AdminSess | null) {
  return !!sess?.ok && sess?.role === 'superadmin';
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const [sess, setSess] = useState<AdminSess | null>(null);

  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setSess(j))
      .catch(() => setSess({ ok: false }));
  }, []);

  const showTenants = isSuperadmin(sess);
  const isImp = !!sess?.ok && !!sess?.imp;

  return (
    <div id="admin-root" className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__left">
          <Link href="/admin" className="admin-brand">
            AurumPass <span style={{ opacity: 0.8, fontWeight: 600 }}>Admin</span>
          </Link>

          {/* Mode badge */}
          {sess?.ok ? (
            <span className="badge" style={{ marginLeft: 8 }} title={sess.user || undefined}>
              {sess.role === 'superadmin' ? 'Platform Admin' : 'Tenant Admin'}
              {sess.role !== 'superadmin' && sess.oid ? ` · ${sess.oid.slice(0, 8)}…` : ''}
            </span>
          ) : (
            <span className="badge" style={{ marginLeft: 8 }}>
              Control Room
            </span>
          )}

          {/* Impersonation badge + exit */}
          {isImp ? (
            <form
              method="post"
              action="/api/admin/impersonate/exit?redirect=/admin/tenants"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8 }}
              title="You are impersonating a tenant admin"
            >
              <span
                className="badge"
                style={{
                  background: 'rgba(245, 158, 11, .18)',
                  border: '1px solid rgba(245, 158, 11, .25)',
                  color: 'rgba(253, 230, 138, .95)',
                }}
              >
                Impersonating{sess.impTenantName ? `: ${sess.impTenantName}` : ''}
              </span>

              <button className="a-btn a-btn--ghost a-btn--strong" type="submit">
                Exit
              </button>
            </form>
          ) : null}

          <nav className="admin-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
            <Link href="/admin/events" className="a-btn a-btn--ghost a-btn--strong">
              Events
            </Link>
            <Link href="/scan" className="a-btn a-btn--ghost a-btn--strong">
              Scanner
            </Link>
            <Link href="/admin/brand" className="a-btn a-btn--ghost a-btn--strong">
              Badge Studio
            </Link>
            <Link href="/admin/theme" className="a-btn a-btn--ghost a-btn--strong">
              Branding
            </Link>

            {showTenants ? (
              <Link
                href="/admin/tenants"
                className="a-btn a-btn--ghost a-btn--strong"
                title="Platform control plane"
                style={{
                  marginLeft: 6,
                  borderColor: 'rgba(245, 158, 11, .35)',
                  background: 'rgba(245, 158, 11, .10)',
                }}
              >
                Manage Tenants
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="admin-header__right">
          <Link href="/admin/events/new" className="a-btn btn-cta">
            New Event
          </Link>

          <a href="/api/admin/events" className="a-btn a-btn--ghost a-btn--strong" title="Events export endpoint">
            Data
          </a>
        </div>
      </header>

      <main className="admin-main">{children}</main>
    </div>
  );
}
