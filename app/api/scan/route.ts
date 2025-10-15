// app/api/scan/route.ts
// app/api/scan/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyTicket } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // 1) Prefer JWT verification if secret is configured
    let reg = null as null | { id: string; attended: boolean; scannedAt: Date | null };
    const payload = process.env.TICKET_JWT_SECRET ? verifyTicket(token) : null;

    if (payload?.sub && payload.eventId) {
      reg = await prisma.registration.findUnique({
        where: { id: payload.sub },
        select: { id: true, attended: true, scannedAt: true },
      });

      // Optional extra-hardening: ensure record matches payload.eventId/email
      if (!reg) {
        // fall through to raw token lookup
      }
    }

    // 2) Fallback to legacy raw token match
    if (!reg) {
      reg = await prisma.registration.findUnique({
        where: { qrToken: token },
        select: { id: true, attended: true, scannedAt: true },
      });
    }

    if (!reg) return NextResponse.json({ error: 'Invalid or unknown ticket' }, { status: 404 });

    // 3) Mark attendance (idempotent)
    const alreadyCheckedIn = !!reg.attended;
    let scannedAt = reg.scannedAt;

    if (!alreadyCheckedIn) {
      const updated = await prisma.registration.update({
        where: { id: reg.id },
        data: { attended: true, scannedAt: new Date() },
        select: { scannedAt: true },
      });
      scannedAt = updated.scannedAt;
    }

    return NextResponse.json({
      ok: true,
      id: reg.id,
      scannedAt,
      alreadyCheckedIn,
    });
  } catch (e) {
    console.error('scan error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
