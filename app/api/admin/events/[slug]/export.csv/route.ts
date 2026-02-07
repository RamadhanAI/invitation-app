// app/api/admin/events/[slug]/export.csv/route.ts
// app/api/admin/events/[slug]/export.csv/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvEscape(v: any) {
  const s = v == null ? '' : String(v);
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const event = await prisma.event.findUnique({
    where: { id: scope.eventId },
    select: { id: true, slug: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const regs = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: [{ registeredAt: 'desc' }],
    select: {
      email: true,
      paid: true,
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

  const header = [
    'email','paid','attended','registeredAt','scannedAt','scannedBy',
    'checkedOutAt','checkedOutBy','qrToken','meta',
  ];

  const lines = [
    header.join(','),
    ...regs.map((r) =>
      [
        r.email,
        r.paid,
        r.attended,
        r.registeredAt?.toISOString?.() ?? '',
        r.scannedAt?.toISOString?.() ?? '',
        r.scannedBy ?? '',
        r.checkedOutAt?.toISOString?.() ?? '',
        r.checkedOutBy ?? '',
        r.qrToken ?? '',
        typeof r.meta === 'string' ? r.meta : JSON.stringify(r.meta ?? {}),
      ].map(csvEscape).join(',')
    ),
  ];

  const csv = lines.join('\n');
  const headers = new Headers();
  headers.set('content-type', 'text/csv; charset=utf-8');
  headers.set('content-disposition', `attachment; filename="registrations-${event.slug}.csv"`);
  headers.set('cache-control', 'no-store');

  return new NextResponse(csv, { status: 200, headers });
}
