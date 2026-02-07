// app/admin/events/[slug]/page.tsx
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import NextDynamic from 'next/dynamic';
import { resolveBadgeConfig } from '@/lib/badgeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// IMPORTANT: client component lives at app/admin/[slug]/AdminDashboardClient.tsx
const AdminDashboardClient = NextDynamic(
  () => import('@/app/admin/[slug]/AdminDashboardClient').then((m) => m.default),
  { ssr: false }
);

// helpers to normalize human-readable name / role from meta
function safeJson(val: any) {
  if (!val) return {};
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  return {};
}

function getName(meta: any) {
  const m = safeJson(meta);
  const cands = [
    m.fullName,
    m.name,
    [m.firstName, m.lastName].filter(Boolean).join(' '),
    [m.givenName, m.familyName].filter(Boolean).join(' '),
  ]
    .map((v) => (v || '').toString().trim())
    .filter(Boolean);
  return cands[0] || 'Guest';
}

function getRole(meta: any) {
  const m = safeJson(meta);
  const raw = m.role || m.badgeRole || m.ticketType || m.tier || '';
  const up = String(raw || '').trim().toUpperCase();
  if (!up) return 'ATTENDEE';
  if (/^vip/.test(up)) return 'VIP';
  if (/staff|crew|team/.test(up)) return 'STAFF';
  if (/speak/.test(up)) return 'SPEAKER';
  if (/press|media/.test(up)) return 'MEDIA';
  return up;
}

export default async function AdminEventPage({ params }: { params: { slug: string } }) {
  // 1) auth using signed cookie session
  const sess = getAdminSession();
  if (!sess) redirect(`/login?next=${encodeURIComponent(`/admin/events/${params.slug}`)}`);

  const isSuper = sess.role === 'superadmin';

  if (!isSuper && !sess.oid) {
    redirect(`/login?next=${encodeURIComponent(`/admin/events/${params.slug}`)}`);
  }

  // 2) fetch event core info (tenant-scoped) + organizer brand for badge config
  const event = await prisma.event.findFirst({
    where: isSuper ? { slug: params.slug } : { slug: params.slug, organizerId: sess.oid! },
    select: {
      id: true,
      slug: true,
      title: true,
      capacity: true,
      organizerId: true,
      organizer: { select: { brand: true } }, // ✅ needed for badge config
    },
  });

  if (!event) {
    return <div className="min-h-screen p-6 text-white bg-black">Event not found.</div>;
  }

  // ✅ Resolve "effective" event badge config (default + per-event override)
  const badgeConfig = resolveBadgeConfig({
    organizerBrand: event.organizer?.brand,
    eventSlug: event.slug,
    requestBadgeOverride: null,
  });

  const badgeStudioUrl = `/admin/events/${encodeURIComponent(event.slug)}#badge-studio`;

  // 3) registrations table data
  const regsDb = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: [{ registeredAt: 'desc' }],
    select: {
      email: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
      qrToken: true,
      meta: true,
    },
  });

  const initialRegistrations = regsDb.map((r) => ({
    email: r.email,
    attended: r.attended,
    registeredAt: r.registeredAt.toISOString(),
    scannedAt: r.scannedAt ? r.scannedAt.toISOString() : null,
    scannedBy: r.scannedBy ?? null,
    checkedOutAt: r.checkedOutAt ? r.checkedOutAt.toISOString() : null,
    checkedOutBy: r.checkedOutBy ?? null,
    qrToken: r.qrToken,
    meta: r.meta,
  }));

  // 4) KPI stats for cards
  const [total, attendedCount] = await Promise.all([
    prisma.registration.count({ where: { eventId: event.id } }),
    prisma.registration.count({ where: { eventId: event.id, attended: true } }),
  ]);

  // 5) last 10 attendance events (scan IN / scan OUT ticker)
  const last10 = await prisma.attendanceEvent.findMany({
    where: { eventId: event.id },
    orderBy: [{ at: 'desc' }],
    take: 10,
    select: {
      action: true,
      stationLabel: true,
      at: true,
      registration: { select: { meta: true } },
    },
  });

  const recentEvents = last10.map((row) => {
    const meta = row.registration?.meta;
    return {
      ts: row.at.toISOString(),
      action: row.action,
      station: row.stationLabel || '',
      name: getName(meta),
      role: getRole(meta),
    };
  });

  const capacity = event.capacity ?? null;

  return (
    <AdminDashboardClient
      slug={event.slug}
      title={event.title}
      attendance={{ total, attended: attendedCount, noShows: Math.max(0, total - attendedCount) }}
      initialRegistrations={initialRegistrations}
      recentEvents={recentEvents}
      capacity={capacity}
      // ✅ NEW
      badgeConfig={badgeConfig}
      badgeStudioUrl={badgeStudioUrl}
    />
  );
}
