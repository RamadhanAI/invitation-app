// app/api/admin/events/[slug]/registration/route.ts
// app/api/admin/events/[slug]/registration/route.ts
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
    email?: string;
    token?: string;
    station?: string;
    paid?: boolean;
    attended?: boolean;
    checkedOut?: boolean;
  };

  const station = typeof body.station === 'string' ? body.station.trim() : undefined;

  // Find by token or email (scoped to event)
  let reg = null as { id: string; meta: unknown } | null;
  if (body.token) {
    reg = await prisma.registration.findUnique({
      where: { qrToken: String(body.token) },
      select: { id: true, meta: true },
    });
  }
  if (!reg && body.email) {
    reg = await prisma.registration.findFirst({
      where: { eventId: g.event.id, email: body.email.toLowerCase().trim() },
      select: { id: true, meta: true },
    });
  }
  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, any> = {};
  if (typeof body.paid === 'boolean') data.paid = body.paid;

  if (typeof body.attended === 'boolean') {
    data.attended = body.attended;
    data.scannedAt = body.attended ? new Date() : null;
    data.scannedBy = body.attended ? (station || 'admin') : null;
    // reset checkout when (re)checking in, or clearing attendance
    data.checkedOutAt = null;
    data.checkedOutBy = null;
  }

  if (typeof body.checkedOut === 'boolean') {
    data.checkedOutAt = body.checkedOut ? new Date() : null;
    data.checkedOutBy = body.checkedOut ? (station || 'admin') : null;
  }

  // log into meta.scanLog
  const current = reg.meta;
  const m = (typeof current === 'string'
    ? (() => { try { return JSON.parse(current); } catch { return {}; } })()
    : (current as any)) || {};
  const log = Array.isArray(m.scanLog) ? m.scanLog : [];

  if (typeof body.attended === 'boolean') {
    const entry = body.attended
      ? { at: new Date().toISOString(), by: station || 'admin', via: 'admin', action: 'checkin' }
      : { at: new Date().toISOString(), by: station || 'admin', via: 'admin', action: 'unattend' };
    data.meta = { ...m, scannedBy: body.attended ? (station || 'admin') : undefined, scanLog: [...log, entry] };
  }
  if (typeof body.checkedOut === 'boolean') {
    const entry = body.checkedOut
      ? { at: new Date().toISOString(), by: station || 'admin', via: 'admin', action: 'checkout' }
      : { at: new Date().toISOString(), by: station || 'admin', via: 'admin', action: 'undo_checkout' };
    data.meta = { ...(data.meta ?? m), scanLog: [...(data.meta?.scanLog ?? log), entry] };
  }

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data,
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

  return NextResponse.json({ ok: true, registration: updated });
}
