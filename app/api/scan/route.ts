// app/api/scan/route.ts
// Toggle IN / OUT based on current registration state.
// Logs every scan in AttendanceEvent.
// Returns a payload the scanner UI can flash.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ───────────────────────── helpers ─────────────────────────

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
  const raw =
    m.role ||
    m.badgeRole ||
    m.ticketType ||
    m.tier ||
    '';
  const up = String(raw || '').trim().toUpperCase();

  if (!up) return 'ATTENDEE';
  if (/^vip/.test(up)) return 'VIP';
  if (/staff|crew|team/.test(up)) return 'STAFF';
  if (/speak/.test(up)) return 'SPEAKER';
  if (/press|media/.test(up)) return 'MEDIA';

  return up;
}

// ───────────────────────── handler ─────────────────────────

export async function POST(req: Request) {
  // token  = the QR token / badge token
  // station = label of the gate/device ("VIP ENTRANCE", "MAIN EXIT")
  const { token, station } = (await req.json().catch(() => ({}))) as {
    token?: string;
    station?: string;
  };

  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Missing token' },
      { status: 400 }
    );
  }

  // 1. pull registration + event info
  const reg = await prisma.registration.findUnique({
    where: { qrToken: token },
    select: {
      id: true,
      eventId: true,
      qrToken: true,

      attended: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,

      meta: true,
      event: {
        select: { title: true },
      },
    },
  });

  if (!reg) {
    return NextResponse.json(
      { ok: false, error: 'Ticket not found' },
      { status: 404 }
    );
  }

  const now = new Date();

  // "inside" means: they've attended at least once AND not currently checked out
  const currentlyIn = reg.attended && !reg.checkedOutAt;
  const currentlyOut = !!reg.checkedOutAt;

  // We'll flip state:
  // - If OUT or never in => mark IN
  // - Else => mark OUT
  let direction: 'IN' | 'OUT';
  let updated: {
    qrToken: string;
    attended: boolean;
    scannedAt: Date | null;
    scannedBy: string | null;
    checkedOutAt: Date | null;
    checkedOutBy: string | null;
    meta: any;
  };

  if (!currentlyIn || currentlyOut) {
    // Treat as IN / re-entry
    direction = 'IN';

    updated = await prisma.registration.update({
      where: { qrToken: token },
      data: {
        attended: true,
        scannedAt: now,
        scannedBy: station || 'Main Gate',
        checkedOutAt: null,
        checkedOutBy: null,
      },
      select: {
        qrToken: true,
        attended: true,
        scannedAt: true,
        scannedBy: true,
        checkedOutAt: true,
        checkedOutBy: true,
        meta: true,
      },
    });
  } else {
    // Treat as OUT / exit
    direction = 'OUT';

    updated = await prisma.registration.update({
      where: { qrToken: token },
      data: {
        checkedOutAt: now,
        checkedOutBy: station || 'Main Gate',
      },
      select: {
        qrToken: true,
        attended: true,
        scannedAt: true,
        scannedBy: true,
        checkedOutAt: true,
        checkedOutBy: true,
        meta: true,
      },
    });
  }

  // 3. Write immutable audit row in AttendanceEvent
  //    Prisma model uses:
  //      action        String        // "IN" | "OUT"
  //      stationLabel  String?
  //      scannedByUser String?
  //
  // We do NOT send { direction } or { station } — those fields do not exist.
  await prisma.attendanceEvent.create({
    data: {
      eventId: reg.eventId,
      registrationId: reg.id,
      qrToken: reg.qrToken,
      action: direction,                // <── FIXED: was direction:
      stationLabel: station || 'Main Gate', // <── FIXED: was station:
      scannedByUser: null,              // could wire staff email later
      // "at" defaults to now()
    },
  });

  // 4. Response for scanner UI wedge/camera
  return NextResponse.json({
    ok: true,
    state: direction, // "IN" or "OUT"
    station: station || 'Main Gate',
    name: getName(updated.meta),
    role: getRole(updated.meta),
    eventTitle: reg.event?.title || '',
    at: now.toISOString(),
    registration: updated,
  });
}
