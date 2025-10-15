// app/api/admin/events/[slug]/registration/bulk/route.ts
// app/api/admin/events/[slug]/registration/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function gate(req: Request, slug: string) {
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const provided = headerKey || bearer;
  const admin = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };
  const orgKey = event.organizer?.apiKey?.trim() || '';
  if (!provided || (provided !== admin && provided !== orgKey)) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }
  return { ok: true as const, event };
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({} as any)) as {
    emails?: string[];
    tokens?: string[];
    paid?: boolean;
    attended?: boolean;
    checkedOut?: boolean;
    station?: string;
  };

  const ids: string[] = [];
  const station = typeof body.station === 'string' ? body.station.trim() : 'bulk';

  if (Array.isArray(body.tokens) && body.tokens.length) {
    const rows = await prisma.registration.findMany({
      where: { eventId: g.event.id, qrToken: { in: body.tokens } },
      select: { id: true },
    });
    ids.push(...rows.map((r: { id: any; }) => r.id));
  }
  if (Array.isArray(body.emails) && body.emails.length) {
    const rows = await prisma.registration.findMany({
      where: { eventId: g.event.id, email: { in: body.emails.map(e => e.toLowerCase().trim()) } },
      select: { id: true },
    });
    ids.push(...rows.map((r: { id: any; }) => r.id));
  }

  if (!ids.length) return NextResponse.json({ ok: true, count: 0, rows: [] });

  const data: any = {};
  if (typeof body.paid === 'boolean') data.paid = body.paid;
  if (typeof body.attended === 'boolean') {
    data.attended = body.attended;
    data.scannedAt = body.attended ? new Date() : null;
    data.scannedBy = body.attended ? station : null;
    data.checkedOutAt = null;
    data.checkedOutBy = null;
  }
  if (typeof body.checkedOut === 'boolean') {
    data.checkedOutAt = body.checkedOut ? new Date() : null;
    data.checkedOutBy = body.checkedOut ? station : null;
  }

  if (Object.keys(data).length) {
    await prisma.registration.updateMany({ where: { id: { in: ids } }, data });
    // optional: skip per-row meta updates for performance in bulk
  }

  const rows = await prisma.registration.findMany({
    where: { id: { in: ids } },
    select: {
      email: true, paid: true, attended: true,
      registeredAt: true, scannedAt: true, scannedBy: true,
      checkedOutAt: true, checkedOutBy: true,
      qrToken: true, meta: true,
    },
    orderBy: { registeredAt: 'desc' },
  });

  return NextResponse.json({ ok: true, count: rows.length, rows });
}
