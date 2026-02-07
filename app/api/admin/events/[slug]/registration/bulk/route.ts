// app/api/admin/events/[slug]/registration/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const { event } = scope;

  const body = (await req.json().catch(() => ({} as any))) as {
    emails?: string[];
    tokens?: string[];
    paid?: boolean;
    attended?: boolean;
    checkedOut?: boolean;
    station?: string;
  };

  const station = typeof body.station === 'string' ? body.station.trim() : 'bulk';

  const idsSet = new Set<string>();

  if (Array.isArray(body.tokens) && body.tokens.length) {
    const rows = await prisma.registration.findMany({
      where: { eventId: event.id, qrToken: { in: body.tokens.map(String) } },
      select: { id: true },
    });
    rows.forEach(r => idsSet.add(r.id));
  }
  if (Array.isArray(body.emails) && body.emails.length) {
    const normEmails = body.emails
      .map(e => String(e ?? '').toLowerCase().trim())
      .filter(Boolean);
    if (normEmails.length) {
      const rows = await prisma.registration.findMany({
        where: { eventId: event.id, email: { in: normEmails } },
        select: { id: true },
      });
      rows.forEach(r => idsSet.add(r.id));
    }
  }

  const ids = Array.from(idsSet.values());
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
    // If caller requests checkout=true without explicitly setting attended=true,
    // we won’t auto-flip attendance in bulk mode.
    if (body.checkedOut && body.attended === false) {
      return NextResponse.json({ error: 'Cannot checkout with attended=false' }, { status: 400 });
    }
    data.checkedOutAt = body.checkedOut ? new Date() : null;
    data.checkedOutBy = body.checkedOut ? station : null;
  }

  if (Object.keys(data).length) {
    await prisma.registration.updateMany({ where: { id: { in: ids } }, data });
    // NOTE: we intentionally skip AttendanceEvent + meta.scanLog writes here
    // for performance (bulk can be thousands of rows). Use single PATCH for audited changes.
  }

  const rows = await prisma.registration.findMany({
    where: { id: { in: ids } },
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
    orderBy: { registeredAt: 'desc' },
  });

  return NextResponse.json({ ok: true, count: rows.length, rows });
}
