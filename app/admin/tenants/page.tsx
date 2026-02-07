// app/admin/tenants/page.tsx
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmt(d?: Date | null) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return String(d);
  }
}

function statusPill(status?: string | null) {
  const s = (status || 'pending').toLowerCase();
  if (s === 'active') return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25';
  if (s === 'suspended') return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25';
  return 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25';
}

export default async function TenantsPage() {
  const sess = getAdminSession();
  if (!sess) redirect('/login?next=/admin/tenants');
  if (sess.role !== 'superadmin') redirect('/admin');

  const tenants = await prisma.organizer.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      events: { select: { id: true } },
      users: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          inviteExpiresAt: true,
          passwordHash: true,
        },
      },
    },
  });

  // ✅ Types derived from the actual Prisma query shape (no drift, no any)
  type TenantRow = (typeof tenants)[number];
  type UserRow = TenantRow['users'][number];

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-4 p-4 a-card md:p-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Tenants</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Super admin control plane — organizers, staff, approval, and access.
          </p>
        </div>

        <Link href="/admin" className="a-btn a-btn--ghost">
          Back
        </Link>
      </section>

      {tenants.length === 0 ? (
        <div className="p-6 a-card text-white/80">No tenants yet.</div>
      ) : (
        <div className="space-y-4">
          {tenants.map((t: TenantRow) => {
            const admin = t.users.find((u: UserRow) => u.role === 'admin');
            const hasPassword = !!(admin?.passwordHash && String(admin.passwordHash).length > 10);

            return (
              <div key={t.id} className="p-4 a-card md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold text-white">{t.name}</div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusPill(
                          t.status
                        )}`}
                      >
                        {(t.status || 'pending').toUpperCase()}
                      </span>
                    </div>

                    <div className="text-sm text-white/70">{t.email}</div>
                    <div className="mt-2 text-xs text-white/50">Created: {fmt(t.createdAt)}</div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end">
                    <div className="text-xs text-white/70">
                      <div>
                        Events: <span className="text-white/90">{t.events.length}</span>
                      </div>
                      <div>
                        Users: <span className="text-white/90">{t.users.length}</span>
                      </div>
                      <div>
                        Admin password: <span className="text-white/90">{hasPassword ? 'Set' : 'Not set'}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Approve (optionally resend invite too) */}
                      <form method="post" action={`/api/admin/tenants/${t.id}/status`} className="inline">
                        <input type="hidden" name="status" value="active" />
                        {/* If you want "Approve = send invite", keep this line.
                           If you want "Approve only", remove it. */}
                        <input type="hidden" name="resendInvite" value="1" />
                        <button
                          className="a-btn a-btn--primary"
                          disabled={(t.status || 'pending') === 'active'}
                          title="Activate tenant"
                        >
                          Approve
                        </button>
                      </form>

                      {/* Suspend */}
                      <form method="post" action={`/api/admin/tenants/${t.id}/status`} className="inline">
                        <input type="hidden" name="status" value="suspended" />
                        <button
                          className="a-btn a-btn--danger"
                          disabled={(t.status || '').toLowerCase() === 'suspended'}
                          title="Suspend tenant"
                        >
                          Suspend
                        </button>
                      </form>

                      {/* Resend invite (works even while pending) */}
                      <form method="post" action={`/api/admin/tenants/${t.id}/invite?redirect=1`} className="inline">
                        <button className="a-btn a-btn--ghost" title="Re-send invite to tenant admin">
                          Resend invite
                        </button>
                      </form>

                      {/* Impersonate tenant admin */}
                      <form
                        method="post"
                        action={`/api/admin/tenants/${t.id}/impersonate?redirect=/admin`}
                        className="inline"
                      >
                        <button className="a-btn a-btn--ghost" title="View the admin as this tenant">
                          Impersonate
                        </button>
                      </form>
                    </div>

                    <div className="text-[11px] text-white/50">
                      Tenant can set password anytime via invite. Login unlocks once approved.
                    </div>
                  </div>
                </div>

                <div className="p-3 mt-4 rounded-xl bg-white/5">
                  <div className="mb-2 text-sm font-medium text-white/80">Staff</div>
                  {t.users.length === 0 ? (
                    <div className="text-sm text-white/60">No staff.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="a-table a-table--tight min-w-[880px]">
                        <thead>
                          <tr className="a-tr">
                            <th className="a-th">Email</th>
                            <th className="a-th">Role</th>
                            <th className="a-th">Active</th>
                            <th className="a-th">Invite exp.</th>
                            <th className="a-th">Last login</th>
                            <th className="a-th">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.users.map((u: UserRow) => (
                            <tr key={u.id} className="a-tr">
                              <td className="a-td text-white/90">{u.email}</td>
                              <td className="a-td text-white/80">{u.role}</td>
                              <td className="a-td text-white/80">{u.isActive ? 'Yes' : 'No'}</td>
                              <td className="a-td text-white/80">{fmt(u.inviteExpiresAt)}</td>
                              <td className="a-td text-white/80">{fmt(u.lastLoginAt)}</td>
                              <td className="a-td text-white/80">{fmt(u.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-4 text-xs text-white/50">
                  Tenant ID: <span className="text-white/70">{t.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
