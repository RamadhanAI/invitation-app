import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { getScannerSession } from '@/lib/scannerSession';

export const runtime = 'nodejs';

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256B64url(token: string) {
  return b64url(crypto.createHash('sha256').update(token).digest());
}

export async function GET() {
  const sess = await getScannerSession();
  if (!sess) return NextResponse.json({ ok: false }, { status: 401 });

  const st = await prisma.station.findUnique({
    where: { id: sess.stationId },
    select: { active: true, eventId: true },
  });
  if (!st || !st.active || st.eventId !== sess.eventId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const regs = await prisma.registration.findMany({
    where: { eventId: sess.eventId },
    select: { qrToken: true },
  });

  return NextResponse.json({
    ok: true,
    count: regs.length,
    hashes: regs.map((r) => sha256B64url(r.qrToken)),
  });
}
