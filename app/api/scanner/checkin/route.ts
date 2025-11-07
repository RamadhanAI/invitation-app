// app/api/scanner/checkin/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifySession } from '@/lib/session';

const COOKIE_NAME = 'scan_sess';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const tokenCookie = cookies().get(COOKIE_NAME)?.value;
  const sess = verifySession(tokenCookie || undefined);
  if (!sess) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });

  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });

  const station = await prisma.station.findUnique({ where: { id: sess.stationId }, select: { name: true, active: true } });
  if (!station || !station.active) return NextResponse.json({ ok: false, error: 'Station inactive' }, { status: 401 });

  const reg = await prisma.registration.findUnique({
    where: { eventId_qrToken: { eventId: sess.eventId, qrToken: token } },
    select: { id: true, email: true, eventId: true, meta: true },
  });
  if (!reg) return NextResponse.json({ ok: false, error: 'Registration not found' }, { status: 404 });

  const updated = await prisma.registration.update({
    where: { id: reg.id },
    data: { attended: true, scannedAt: new Date(), scannedBy: station.name, checkedOutAt: null, checkedOutBy: null },
    select: { email: true, attended: true, scannedAt: true, scannedBy: true, qrToken: true, checkedOutAt: true, checkedOutBy: true },
  });

  // immutable audit row
  await prisma.attendanceEvent.create({
    data: { eventId: reg.eventId, registrationId: reg.id, qrToken: token, action: 'IN', stationLabel: station.name, scannedByUser: null },
  });

  return NextResponse.json({ ok: true, registration: updated });
}
