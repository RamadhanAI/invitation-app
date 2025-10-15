// app/admin/events/page.tsx
// app/admin/events/page.tsx
import Link from 'next/link';

type EventRow = {
  id: string;
  slug: string;
  title: string;
  date: string | null;
  price: number;
  status: string;
  currency?: string | null;
  venue?: string | null;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(d);
}
function fmtMoney(v: number, ccy?: string | null) {
  if (!v || v === 0) return 'Free';
  const currency = ccy || 'USD';
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).format(v); }
  catch { return `${v} ${currency}`; }
}

async function getEvents(): Promise<EventRow[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '';
  const res = await fetch(`${base}/api/admin/events`, {
    cache: 'no-store',
    headers: adminKey ? { 'x-api-key': adminKey } : {},
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return data.events ?? [];
}

export default async function AdminEventsPage() {
  const events = await getEvents();

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
              <th className="text-left a-th">Date</th>
              <th className="text-left a-th">Price</th>
              <th className="text-left a-th">Status</th>
              <th className="text-left a-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr className="a-tr">
                <td colSpan={5} className="a-td" style={{ color: 'var(--muted)' }}>
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
                <td className="a-td">{fmtDate(e.date)}</td>
                <td className="a-td">{fmtMoney(e.price, e.currency)}</td>
                <td className="a-td">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    {e.status}
                  </span>
                </td>
                <td className="a-td">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/events/${encodeURIComponent(e.slug)}`} className="a-btn">Open</Link>
                    <a
                      className="a-btn a-btn--ghost"
                      href={`/api/admin/events/${encodeURIComponent(e.slug)}/export.csv`}
                    >
                      Export CSV
                    </a>
                    <Link href={`/e/${encodeURIComponent(e.slug)}`} className="a-btn a-btn--ghost">Public page</Link>
                    <Link href={`/admin/events/${encodeURIComponent(e.slug)}/edit`} className="a-btn a-btn--ghost">
                      Edit
                    </Link>
                    <form
                      action={`/api/admin/events/${encodeURIComponent(e.slug)}`}
                      method="POST"
                      className="inline"
                    >
                      <input type="hidden" name="action" value="delete" />
                      <button className="a-btn a-btn--ghost" title="Delete event">
                        Delete
                      </button>
                    </form>
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
