// app/page.tsx
// app/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ---------- helpers ---------- */
function moneyLabel(v: number | null | undefined, ccy: string | null | undefined) {
  if (!v || v === 0) return 'Free';
  const currency = ccy || 'USD';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(v);
  } catch {
    return `${v} ${currency}`;
  }
}
function dateLabel(d: Date | null | undefined) {
  if (!d) return 'No date';
  try {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toString();
  }
}

export default async function HomePage() {
  /* Fail-soft fetch so the homepage never crashes during DB hiccups */
  let events:
    | {
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
      take: 6,
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
    // swallow; page renders with "no events yet" message
  }

  return (
    <div className="grid gap-8">
      {/* Hero */}
      <section className="p-8 border card md:p-12 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-indigo-500/10 border-white/10">
        <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
          Host events with style. <span className="text-violet-400">Invite</span>, pay, and check-in.
        </h1>
        <p className="max-w-2xl mt-4 text-white/70">
          Publish an event page, accept registrations, email QR tickets with ICS, and scan at the door.
        </p>

        {/* Unified, bold hero buttons */}
        <div className="flex flex-wrap gap-4 mt-7">
          <Link
            href="/admin/events"
            className="a-btn a-btn--accent a-btn--hero a-btn--hero-shine"
            aria-label="Open Dashboard"
          >
            Open Dashboard
          </Link>
          <Link
            href="/admin/events/new"
            className="a-btn a-btn--accent a-btn--hero a-btn--hero-shine"
            aria-label="Create Event"
          >
            Create Event
          </Link>
          <Link
            href="/scan"
            className="a-btn a-btn--accent a-btn--hero a-btn--hero-shine"
            aria-label="Open Scanner"
          >
            Open Scanner
          </Link>
        </div>
      </section>

      {/* Quick tiles */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: 'Instant Tickets', desc: 'Every registration gets a QR ticket + ICS.' },
          { title: 'Fast Check-in', desc: 'Camera or keyboard wedge in any browser.' },
          { title: 'CSV In & Out', desc: 'Bulk import attendees, export attendance.' },
        ].map((f) => (
          <div key={f.title} className="p-5 border card border-white/10">
            <div className="text-lg font-medium">{f.title}</div>
            <div className="mt-1 text-sm text-white/60">{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Recent events */}
      <section className="p-6 border card border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Events</h2>
          <Link href="/admin/events" className="a-btn a-btn--ghost" aria-label="View all events">
            View all
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="mt-4 text-sm text-white/60">
            No events yet. Click <em>Create Event</em> to get started.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/10">
            {events.map((e) => (
              <div key={e.id} className="grid gap-3 py-4 md:grid-cols-12 md:items-center">
                <div className="md:col-span-5">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-white/60">/{e.slug}</div>
                </div>

                <div className="text-sm md:col-span-3">
                  <div className="text-white/80">{dateLabel(e.date)}</div>
                  {e.venue && <div className="text-xs text-white/60">{e.venue}</div>}
                </div>

                <div className="text-sm md:col-span-2">
                  <div className="text-white/80">{moneyLabel(e.price, e.currency)}</div>
                  <div className="text-xs capitalize text-white/60">{e.status ?? 'published'}</div>
                </div>

                <div className="flex flex-wrap gap-2 md:col-span-2 md:justify-end">
                  <Link href={`/admin/events/${e.slug}`} className="a-btn">
                    Admin
                  </Link>
                  <Link href={`/e/${e.slug}`} className="a-btn a-btn--ghost">
                    Public
                  </Link>
                  <Link href={`/api/admin/events/${e.slug}/export.csv`} className="a-btn a-btn--ghost">
                    Export CSV
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
