import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        title: true,
        date: true,
        price: true,
        currency: true,
        venue: true,
        capacity: true,
        status: true,
      },
    });

    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(event, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Fast, explicit failure instead of long stack traces
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  }
}
