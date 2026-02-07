// app/admin/events/page.tsx
// app/admin/events/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { redirect } from 'next/navigation';

type Row = {
  id: string;
  slug: string;
  title: string;
  date: Date | null;
  price: number;
  status: string;
  currency: string | null;
  venue: string | null;
  organizerName?: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function fmtDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(d);
}

function fmtMoneyCents(cents: number, ccy?: string | null) {
  if (!cents || cents === 0) return 'Free';
  const currency = ccy || 'USD';
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

async function getRows(): Promise<{ rows: Row[]; isSuper: boolean }> {
  const session = getAdminSession();
  if (!session) redirect('/login?err=1&next=/admin/events');

  const isSuper = session.role === 'superadmin';

  const events = await prisma.event.findMany({
    where: isSuper ? undefined : { organizerId: session.oid || '' },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      date: true,
      price: true,
      status: true,
      currency: true,
      venue: true,
      organizer: { select: { name: true } },
    },
  });

  return {
    isSuper,
    rows: events.map((e) => ({
      ...e,
      organizerName: e.organizer?.name ?? null,
    })),
  };
}

export default async function AdminEventsPage() {
  const { rows: events, isSuper } = await getRows();

  return (
    <div className="py-6 space-y-6 admin-container">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <div className="flex gap-2">
          <Link href="/scan" className="a-btn a-btn--ghost">Scanner</Link>
          <Link href="/admin/events/new" className="a-btn a-btn--primary">New Event</Link>
        </div>
      </div>

      <div className="overflow-hidden a-card">
        <table className="w-full a-table">
          <thead>
            <tr>
              <th className="text-left a-th">Title</th>
              {isSuper && <th className="text-left a-th">Organizer</th>}
              <th className="text-left a-th">Date</th>
              <th className="text-left a-th">Price</th>
              <th className="text-left a-th">Status</th>
              <th className="text-left a-th">Actions</th>
            </tr>
          </thead>

          <tbody>
            {events.length === 0 && (
              <tr className="a-tr">
                <td colSpan={isSuper ? 6 : 5} className="a-td" style={{ color: 'var(--muted)' }}>
                  No events yet.
                </td>
              </tr>
            )}

            {events.map((e) => (
              <tr key={e.id} className="a-tr hover:bg-white/5">
                <td className="a-td">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs opacity-70">/{e.slug}</div>
                </td>

                {isSuper && <td className="a-td">{e.organizerName || '—'}</td>}

                <td className="a-td">{fmtDate(e.date)}</td>
                <td className="a-td">{fmtMoneyCents(e.price, e.currency)}</td>

                <td className="a-td">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    {e.status}
                  </span>
                </td>

                <td className="a-td">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/events/${encodeURIComponent(e.slug)}`} className="a-btn">Open</Link>
                    <a className="a-btn a-btn--ghost" href={`/api/admin/events/${encodeURIComponent(e.slug)}/export.csv`}>
                      Export CSV
                    </a>
                    <Link href={`/e/${encodeURIComponent(e.slug)}`} className="a-btn a-btn--ghost">Public page</Link>
                    <Link href={`/admin/events/${encodeURIComponent(e.slug)}/edit`} className="a-btn a-btn--ghost">
                      Edit
                    </Link>
                    <Link href={`/scan?slug=${encodeURIComponent(e.slug)}`} className="a-btn a-btn--ghost">
                      Scanner
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
