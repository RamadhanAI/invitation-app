// app/api/scanner/checkin/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScannerSession } from '@/lib/scannerSession';

export const runtime = 'nodejs';

type CheckState =
  | 'IN'
  | 'REIN'
  | 'ALREADY_IN'
  | 'OUT'
  | 'ALREADY_OUT'
  | 'NOT_IN'
  | 'DUPLICATE';

type ActionMode = 'IN' | 'OUT' | 'TOGGLE';

function normalizeMode(v: unknown): ActionMode {
  const s = String(v || '').trim().toUpperCase();
  if (s === 'OUT') return 'OUT';
  if (s === 'TOGGLE') return 'TOGGLE';
  return 'IN';
}

export async function POST(req: Request) {
  const sess = await getScannerSession();
  if (!sess) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const qrToken = String(body?.token || '').trim();
  const mode = normalizeMode(body?.action);

  if (!qrToken) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: sess.stationId },
    select: { id: true, name: true, active: true, eventId: true },
  });

  if (!station || !station.active || station.eventId !== sess.eventId) {
    return NextResponse.json({ ok: false, error: 'Station inactive' }, { status: 401 });
  }

  const reg = await prisma.registration.findUnique({
    where: { eventId_qrToken: { eventId: sess.eventId, qrToken } },
    select: {
      id: true,
      email: true,
      eventId: true,
      qrToken: true,
      meta: true,
      attended: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
    },
  });

  if (!reg) {
    return NextResponse.json({ ok: false, error: 'Registration not found' }, { status: 404 });
  }

  const isIn = Boolean(reg.attended) && reg.checkedOutAt === null;
  const now = new Date();

  // quick duplicate guard (3s)
  const lastAt = (reg.checkedOutAt || reg.scannedAt)?.getTime?.() || 0;
  if (lastAt && Date.now() - lastAt < 3000) {
    return NextResponse.json({ ok: true, state: 'DUPLICATE' as CheckState, registration: reg });
  }

  // default IN behavior
  if (mode === 'IN' && isIn) {
    return NextResponse.json({ ok: true, state: 'ALREADY_IN' as CheckState, registration: reg });
  }

  // determine action if TOGGLE
  const doOut = mode === 'OUT' || (mode === 'TOGGLE' && isIn);
  const doIn = mode === 'IN' || (mode === 'TOGGLE' && !isIn);

  if (doOut && !isIn) {
    return NextResponse.json({ ok: true, state: 'NOT_IN' as CheckState, registration: reg });
  }

  if (doIn) {
    const state: CheckState = reg.attended ? 'REIN' : 'IN';

    const updated = await prisma.registration.update({
      where: { id: reg.id },
      data: {
        attended: true,
        scannedAt: now,
        scannedBy: station.name,
        checkedOutAt: null,
        checkedOutBy: null,
      },
      select: {
        id: true,
        email: true,
        eventId: true,
        qrToken: true,
        meta: true,
        attended: true,
        scannedAt: true,
        scannedBy: true,
        checkedOutAt: true,
        checkedOutBy: true,
      },
    });

    await prisma.attendanceEvent.create({
      data: {
        eventId: reg.eventId,
        registrationId: reg.id,
        qrToken,
        action: 'IN',
        stationLabel: station.name,
        scannedByUser: null,
      },
    });

    return NextResponse.json({ ok: true, state, registration: updated });
  }

  // OUT
  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: {
      checkedOutAt: now,
      checkedOutBy: station.name,
    },
    select: {
      id: true,
      email: true,
      eventId: true,
      qrToken: true,
      meta: true,
      attended: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
    },
  });

  await prisma.attendanceEvent.create({
    data: {
      eventId: reg.eventId,
      registrationId: reg.id,
      qrToken,
      action: 'OUT',
      stationLabel: station.name,
      scannedByUser: null,
    },
  });

  return NextResponse.json({ ok: true, state: 'OUT' as CheckState, registration: updated });
}
