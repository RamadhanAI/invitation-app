// app/api/admin/stations/route.ts  (POST: create station)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { eventSlug, name, code, secret } = await req.json();
    if (!eventSlug || !name || !code || !secret) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const event = await prisma.event.findUnique({ where: { slug: eventSlug }, select: { id: true } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const secretHash = await bcrypt.hash(secret, 10);
    const st = await prisma.station.create({
      data: { eventId: event.id, name, code, secretHash, active: true },
      select: { id: true, name: true, code: true },
    });
    return NextResponse.json({ ok: true, station: st });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
