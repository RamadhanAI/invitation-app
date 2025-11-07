// app/api/scanner/session/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { signSession, verifySession } from '@/lib/session';
import { verifySecret } from '@/lib/password';

const COOKIE_NAME = 'scan_sess'; // ✅ single source of truth

export async function GET() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const sess = verifySession(token || undefined);
  if (!sess) return NextResponse.json({ ok: false }, { status: 401 });

  const station = await prisma.station.findUnique({
    where: { id: sess.stationId },
    select: { id: true, name: true, active: true, eventId: true, event: { select: { slug: true, title: true } } },
  });
  if (!station || !station.active) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok: true,
    station: { id: station.id, name: station.name, eventId: station.eventId, eventSlug: station.event.slug, eventTitle: station.event.title },
  });
}

export async function POST(req: Request) {
  const { eventSlug, code, secret } = await req.json().catch(() => ({}));
  if (!eventSlug || !code || !secret) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { slug: eventSlug }, select: { id: true } });
  if (!event) return NextResponse.json({ ok: false, error: 'Event not found' }, { status: 404 });

  const station = await prisma.station.findUnique({
    where: { station_event_code: { eventId: event.id, code } },
    select: { id: true, name: true, active: true, secretHash: true },
  });
  if (!station || !station.active) return NextResponse.json({ ok: false, error: 'Invalid station or inactive' }, { status: 401 });

  const ok = await verifySecret(String(secret), station.secretHash);
  if (!ok) return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });

  const value = signSession({ stationId: station.id, eventId: event.id, iat: Date.now() });
  cookies().set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ ok: true, station: { id: station.id, name: station.name, eventId: event.id, eventSlug } });
}

export async function DELETE() {
  cookies().delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
