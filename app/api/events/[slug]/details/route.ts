// app/api/events/[slug]/details/route.ts
// app/api/events/[slug]/details/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = (params?.slug || '').toString().trim();
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        price: true,
        currency: true,
        venue: true,
        capacity: true,
        status: true,
        description: true,

        organizer: {
          select: { brand: true },
        },
      },
    });

    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, event }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    // Keep it explicit and non-crashy
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }
}
