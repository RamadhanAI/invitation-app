// app/api/admin/events/[slug]/registration/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseMeta(current: unknown): Record<string, any> {
  if (!current) return {};
  if (typeof current === 'string') {
    try {
      const parsed = JSON.parse(current);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof current === 'object' ? (current as any) : {};
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  // Cookie-based admin session + tenant scoping
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const { event } = scope;

  const body = (await req.json().catch(() => ({} as any))) as {
    email?: string;
    token?: string;
    station?: string;
    paid?: boolean;
    attended?: boolean;
    checkedOut?: boolean;
  };

  const station = typeof body.station === 'string' ? body.station.trim() : undefined;

  // Find registration by token or email, ALWAYS scoped to this event
  let reg = null as {
    id: string;
    eventId: string;
    email: string;
    attended: boolean;
    checkedOutAt: Date | null;
    meta: unknown;
  } | null;

  if (body.token) {
    reg = await prisma.registration.findFirst({
      where: { eventId: event.id, qrToken: String(body.token) },
      select: { id: true, eventId: true, email: true, attended: true, checkedOutAt: true, meta: true },
    });
  }
  if (!reg && body.email) {
    reg = await prisma.registration.findFirst({
      where: { eventId: event.id, email: body.email.toLowerCase().trim() },
      select: { id: true, eventId: true, email: true, attended: true, checkedOutAt: true, meta: true },
    });
  }

  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Compute next-state (prevents impossible combos like checkout while not attended)
  const nextAttended = typeof body.attended === 'boolean' ? body.attended : reg.attended;
  const nextCheckedOut = typeof body.checkedOut === 'boolean' ? body.checkedOut : !!reg.checkedOutAt;
  if (nextCheckedOut && !nextAttended) {
    return NextResponse.json({ error: 'Cannot check out a registration that is not checked in.' }, { status: 400 });
  }

  const now = new Date();
  const data: Record<string, any> = {};
  const auditEvents: { action: 'IN' | 'OUT'; stationLabel: string; at: Date; registrationId: string; eventId: string }[] = [];

  if (typeof body.paid === 'boolean') data.paid = body.paid;

  if (typeof body.attended === 'boolean') {
    data.attended = body.attended;
    data.scannedAt = body.attended ? now : null;
    data.scannedBy = body.attended ? (station || 'admin') : null;

    // reset checkout when (re)checking in OR clearing attendance
    data.checkedOutAt = null;
    data.checkedOutBy = null;

    auditEvents.push({
      eventId: event.id,
      registrationId: reg.id,
      action: body.attended ? 'IN' : 'OUT',
      stationLabel: station || 'admin',
      at: now,
    });
  }

  if (typeof body.checkedOut === 'boolean') {
    data.checkedOutAt = body.checkedOut ? now : null;
    data.checkedOutBy = body.checkedOut ? (station || 'admin') : null;

    // If we are undoing a checkout and the person remains attended, log an IN.
    // If we're checking out, log an OUT.
    const stillAttended = typeof body.attended === 'boolean' ? body.attended : reg.attended;
    if (body.checkedOut) {
      auditEvents.push({
        eventId: event.id,
        registrationId: reg.id,
        action: 'OUT',
        stationLabel: station || 'admin',
        at: now,
      });
    } else if (stillAttended) {
      auditEvents.push({
        eventId: event.id,
        registrationId: reg.id,
        action: 'IN',
        stationLabel: station || 'admin',
        at: now,
      });
    }
  }

  // log into meta.scanLog (kept for compatibility with previous exports)
  const m = parseMeta(reg.meta);
  const log = Array.isArray(m.scanLog) ? m.scanLog : [];

  if (typeof body.attended === 'boolean') {
    const entry = body.attended
      ? { at: now.toISOString(), by: station || 'admin', via: 'admin', action: 'checkin' }
      : { at: now.toISOString(), by: station || 'admin', via: 'admin', action: 'unattend' };
    data.meta = {
      ...m,
      scannedBy: body.attended ? (station || 'admin') : undefined,
      scanLog: [...log, entry],
    };
  }
  if (typeof body.checkedOut === 'boolean') {
    const entry = body.checkedOut
      ? { at: now.toISOString(), by: station || 'admin', via: 'admin', action: 'checkout' }
      : { at: now.toISOString(), by: station || 'admin', via: 'admin', action: 'undo_checkout' };
    const prior = (data.meta ?? m) as any;
    const priorLog = Array.isArray(prior.scanLog) ? prior.scanLog : log;
    data.meta = { ...prior, scanLog: [...priorLog, entry] };
  }

  const [updated] = await prisma.$transaction([
    prisma.registration.update({
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
    }),
    ...(auditEvents.length
      ? [
          prisma.attendanceEvent.createMany({
            data: auditEvents.map((e) => ({
              eventId: e.eventId,
              registrationId: e.registrationId,
              action: e.action,
              stationLabel: e.stationLabel,
              at: e.at,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, registration: updated });
}
