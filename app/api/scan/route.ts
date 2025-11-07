// app/api/scan/route.ts
// Toggle IN / OUT based on current registration state.
// Logs every scan in AttendanceEvent.
// Returns a payload the scanner UI can flash.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeJson(val: any) { if (!val) return {}; if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } } if (typeof val === 'object' && !Array.isArray(val)) return val; return {}; }
function getName(meta: any) {
  const m = safeJson(meta);
  const c = [
    m.fullName, m.name,
    [m.firstName, m.lastName].filter(Boolean).join(' '),
    [m.givenName, m.familyName].filter(Boolean).join(' ')
  ].map((v) => (v || '').toString().trim()).filter(Boolean);
  return c[0] || 'Guest';
}
function getRole(meta: any) {
  const up = String((safeJson(meta).role || safeJson(meta).badgeRole || safeJson(meta).ticketType || safeJson(meta).tier || 'ATTENDEE')).trim().toUpperCase();
  if (/^vip/.test(up)) return 'VIP'; if (/staff|crew|team/.test(up)) return 'STAFF'; if (/speak/.test(up)) return 'SPEAKER'; if (/press|media/.test(up)) return 'MEDIA';
  return up || 'ATTENDEE';
}

export async function POST(req: Request) {
  const { token, station } = await req.json().catch(() => ({} as any));
  if (!token) return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });

  const reg = await prisma.registration.findUnique({
    where: { qrToken: token },
    select: { id: true, eventId: true, qrToken: true, attended: true, scannedAt: true, scannedBy: true, checkedOutAt: true, checkedOutBy: true, meta: true, event: { select: { title: true } } },
  });
  if (!reg) return NextResponse.json({ ok: false, error: 'Ticket not found' }, { status: 404 });

  const now = new Date();
  const currentlyIn = reg.attended && !reg.checkedOutAt;
  const direction: 'IN' | 'OUT' = (!currentlyIn || !!reg.checkedOutAt) ? 'IN' : 'OUT';

  const updated = direction === 'IN'
    ? await prisma.registration.update({
        where: { qrToken: token },
        data: { attended: true, scannedAt: now, scannedBy: station || 'Main Gate', checkedOutAt: null, checkedOutBy: null },
        select: { qrToken: true, attended: true, scannedAt: true, scannedBy: true, checkedOutAt: true, checkedOutBy: true, meta: true },
      })
    : await prisma.registration.update({
        where: { qrToken: token },
        data: { checkedOutAt: now, checkedOutBy: station || 'Main Gate' },
        select: { qrToken: true, attended: true, scannedAt: true, scannedBy: true, checkedOutAt: true, checkedOutBy: true, meta: true },
      });

  await prisma.attendanceEvent.create({
    data: { eventId: reg.eventId, registrationId: reg.id, qrToken: reg.qrToken, action: direction, stationLabel: station || 'Main Gate', scannedByUser: null },
  });

  return NextResponse.json({
    ok: true,
    state: direction,
    station: station || 'Main Gate',
    name: getName(updated.meta),
    role: getRole(updated.meta),
    eventTitle: reg.event?.title || '',
    at: now.toISOString(),
    registration: updated,
  });
}
