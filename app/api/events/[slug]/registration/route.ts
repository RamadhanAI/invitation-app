// app/api/events/[slug]/registration/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminForSlug } from '@/lib/adminAuth';
import { isLikelyJwt, verifyTicket } from '@/lib/tokens';
// import { sendRegistrationEmail } from '@/lib/email'; // optional: wire if you want resend to actually email

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: list registrations (admin only)
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const registrations = await prisma.registration.findMany({
    where: { eventId: gate.eventId },
    orderBy: { registeredAt: 'desc' },
    select: {
      email: true,
      paid: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      qrToken: true,
    },
  });

  return NextResponse.json({ ok: true, registrations }, { headers: { 'cache-control': 'no-store' } });
}

// PATCH: update one registration (paid/attended/resend)
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({} as any)) as {
    email?: string;
    token?: string;         // jwt or legacy token
    paid?: boolean;
    attended?: boolean;
    resendEmail?: boolean;
  };

  // Find the row
  let reg = null as null | { id: string };
  if (body.email) {
    reg = await prisma.registration.findFirst({
      where: { eventId: gate.eventId, email: body.email.toLowerCase().trim() },
      select: { id: true },
    });
  } else if (body.token) {
    if (isLikelyJwt(body.token)) {
      const p = verifyTicket(body.token);
      if (p?.sub) reg = await prisma.registration.findFirst({ where: { id: p.sub, eventId: gate.eventId }, select: { id: true } });
    }
    if (!reg) {
      reg = await prisma.registration.findFirst({ where: { eventId: gate.eventId, qrToken: body.token }, select: { id: true } });
    }
  }

  if (!reg) return NextResponse.json({ error: 'Registration not found' }, { status: 404 });

  const data: any = {};
  if (typeof body.paid === 'boolean') data.paid = body.paid;
  if (typeof body.attended === 'boolean') {
    data.attended = body.attended;
    data.scannedAt = body.attended ? new Date() : null;
  }

  if (Object.keys(data).length) {
    await prisma.registration.update({ where: { id: reg.id }, data });
  }

  // Optional: actually resend email (skip for now; your UI only needs ok=true)
  // if (body.resendEmail) { ...sendRegistrationEmail(...) }

  const updated = await prisma.registration.findUnique({
    where: { id: reg.id },
    select: {
      email: true,
      paid: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      qrToken: true,
    },
  });

  return NextResponse.json({ ok: true, registration: updated }, { headers: { 'cache-control': 'no-store' } });
}
