// app/t/[token]/print/page.tsx
// app/t/[token]/print/page.tsx
import { prisma } from '@/lib/db';
import PrintSheet from './PrintSheet';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

type Params = { token: string };
type Search = { side?: string; auto?: string };

function brandFromOrganizer(brand: unknown): Record<string, unknown> {
  if (typeof brand === 'string') {
    try { return JSON.parse(brand); } catch { return {}; }
  }
  if (brand && typeof brand === 'object' && !Array.isArray(brand)) return brand as Record<string, unknown>;
  return {};
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const token = decodeURIComponent(params.token);

  const reg = await prisma.registration.findFirst({
    where: { qrToken: token },
    select: { id: true, meta: true, eventId: true, qrToken: true },
  });

  if (!reg) {
    return (
      <div style={{ padding: 24, color: 'white', fontFamily: 'ui-sans-serif, system-ui' }}>
        Invalid or expired ticket.
      </div>
    );
  }

  const ev = await prisma.event.findUnique({
    where: { id: reg.eventId },
    select: { title: true, organizerId: true },
  });

  const org = ev?.organizerId
    ? await prisma.organizer.findUnique({
        where: { id: ev.organizerId },
        select: { brand: true },
      })
    : null;

  const brand = brandFromOrganizer(org?.brand);

  const meta = (reg.meta ?? {}) as Record<string, unknown>;
  const first = (meta.firstName ?? meta.givenName ?? '') as string;
  const last  = (meta.lastName  ?? meta.familyName ?? '') as string;
  const fullName = [first, last].filter(Boolean).join(' ') || ((meta.fullName as string) ?? 'Guest');

  const jobTitle    = ((meta.jobTitle ?? meta.title) as string) || '';
  const companyName = ((meta.companyName ?? meta.company) as string) || '';
  const roleRaw     = ((meta.role ?? meta.badgeRole ?? meta.ticketType ?? meta.tier) as string) || '';
  const role        = roleRaw ? roleRaw.toUpperCase() : 'ATTENDEE';

  const h = headers();
  const origin =
    (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
      `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host') ?? ''}`) || '';

  const side = (searchParams.side === 'front' || searchParams.side === 'back')
    ? (searchParams.side as 'front' | 'back')
    : 'back';
  const auto = searchParams.auto === '1';

  return (
    <PrintSheet
      data={{
        token,
        eventTitle: ev?.title ?? 'Event',
        fullName,
        jobTitle,
        companyName,
        role,
        brand,
        origin,
      }}
      side={side}
      auto={auto}
    />
  );
}
