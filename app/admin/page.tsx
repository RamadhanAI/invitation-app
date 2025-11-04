// app/admin/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import EventDetails from '@/components/EventDetails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function moneyLabel(v: number | null | undefined, ccy: string | null | undefined) {
  if (!v || v === 0) return 'Free';
  const currency = ccy || 'USD';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format((v ?? 0) / 100);
  } catch {
    return `${(v || 0) / 100} ${currency}`;
  }
}

function dateLabel(d: Date | null | undefined) {
  if (!d) return 'No date';
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toString();
  }
}

export default async function AdminHomePage() {
  let events: {
    id: string;
    slug: string;
    title: string;
    date: Date | null;
    price: number | null;
    currency: string | null;
    status: string | null;
    venue: string | null;
  }[] = [];

  try {
    events = await prisma.event.findMany({
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 4,
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        price: true,
        currency: true,
        status: true,
        venue: true,
      },
    });
  } catch {
    events = [];
  }

  const featured = events[0];

  return (
    <div className="space-y-6">
      {/* Top welcome / CTAs */}
      <section className="flex flex-col gap-4 p-4 a-card md:p-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-[color:var(--muted)] max-w-[50ch]">
            Track registrations, scan tickets, update branding, and export
            attendance — all from one place. This is the control room.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/events/new" className="a-btn a-btn--primary">
            + New Event
          </Link>
          <Link href="/scan" className="a-btn a-btn--strong">
            Open Scanner
          </Link>
          <Link href="/admin/theme" className="a-btn a-btn--ghost">
            Branding
          </Link>
        </div>
      </section>

      {/* Live featured event / snapshot */}
      {featured ? (
        <section className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: live widget */}
          <div className="lg:col-span-7">
            <EventDetails
              slug={featured.slug}
              refreshMs={60_000}
              className="banana-sheen-hover"
            />

            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href={`/admin/events/${featured.slug}`}
                className="a-btn a-btn--strong"
              >
                Manage attendees
              </Link>
              <Link
                href={`/e/${featured.slug}`}
                className="a-btn a-btn--ghost"
                target="_blank"
              >
                View public page
              </Link>
              <Link
                href={`/api/admin/events/${featured.slug}/export.csv`}
                className="a-btn a-btn--ghost"
              >
                Export CSV
              </Link>
            </div>
          </div>

          {/* RIGHT: snapshot + quick actions */}
          <div className="space-y-4 lg:col-span-5">
            <div className="p-4 a-card a-card--soft">
              <div className="mb-2 text-sm font-medium text-white/80">
                Event Snapshot
              </div>
              <div className="text-xs text-[color:var(--muted)] mb-4">
                {featured.title}
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Date / Time</span>
                  <span className="text-white/90">{dateLabel(featured.date)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Venue</span>
                  <span className="text-white/90">{featured.venue || '—'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Pricing</span>
                  <span className="text-white/90">
                    {moneyLabel(featured.price, featured.currency)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[color:var(--muted)]">Status</span>
                  <span className="capitalize text-white/90">
                    {featured.status || 'published'}
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-4 a-card">
              <div className="mb-2 text-sm font-medium text-white/80">
                Quick Actions
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href="/scan" className="a-btn a-btn--primary">
                  Start Check-In
                </Link>
                <Link href="/admin/theme" className="a-btn a-btn--ghost">
                  Edit Branding
                </Link>
                <Link href="/admin/events" className="a-btn a-btn--ghost">
                  All Events
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="p-6 text-center a-card">
          <div className="mb-2 text-lg font-semibold text-white">
            No events yet
          </div>
          <div className="text-sm text-[color:var(--muted)] mb-4 max-w-[50ch] mx-auto">
            Create your first event, publish a registration page, and we’ll
            show live stats here.
          </div>
          <Link href="/admin/events/new" className="a-btn a-btn--primary">
            Create Event
          </Link>
        </section>
      )}

      {/* Recent events table */}
      <section className="p-4 overflow-x-auto a-card md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Recent Events</h2>
          <Link href="/admin/events" className="text-sm a-btn a-btn--ghost">
            View all
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="text-sm text-[color:var(--muted)]">
            Nothing to show yet.
          </div>
        ) : (
          <table className="a-table a-table--tight min-w-[600px]">
            <thead>
              <tr className="a-tr">
                <th className="a-th a-col-name">Title</th>
                <th className="a-th a-col-datetime">When</th>
                <th className="a-th">Venue</th>
                <th className="a-th">Price</th>
                <th className="a-th">Status</th>
                <th className="text-right a-th a-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr className="a-tr" key={ev.id}>
                  <td className="a-td a-col-name">
                    <div className="font-medium text-white/90">{ev.title}</div>
                    <div className="text-xs text-[color:var(--muted)]">
                      /{ev.slug}
                    </div>
                  </td>

                  <td className="text-sm a-td a-col-datetime text-white/80">
                    {dateLabel(ev.date)}
                  </td>

                  <td className="text-sm a-td text-white/80">
                    {ev.venue || '—'}
                  </td>

                  <td className="text-sm a-td text-white/80">
                    {moneyLabel(ev.price, ev.currency)}
                  </td>

                  <td className="text-sm capitalize a-td text-white/80">
                    {ev.status || 'published'}
                  </td>

                  <td className="text-right a-td a-col-actions">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/admin/events/${ev.slug}`}
                        className="a-btn a-btn--strong"
                      >
                        Admin
                      </Link>
                      <Link
                        href={`/e/${ev.slug}`}
                        className="a-btn a-btn--ghost"
                        target="_blank"
                      >
                        Public
                      </Link>
                      <Link
                        href={`/api/admin/events/${ev.slug}/export.csv`}
                        className="a-btn a-btn--ghost"
                      >
                        CSV
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
