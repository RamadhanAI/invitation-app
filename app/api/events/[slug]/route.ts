// app/api/events/[slug]/route.ts
// app/api/events/[slug]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public event details. If a valid key is sent (organizer or admin), include registrations (+meta).
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const headerKey = (req.headers.get('x-api-key') ?? '').trim();
    const devKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
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
        organizer: { select: { apiKey: true } }, // used only for auth comparison
      },
    });

    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Strip organizer from the public payload
    const { organizer, ...publicEvent } = event;

    // Auth: organizer key for THIS event OR admin/dev key
    const authorized =
      !!headerKey &&
      (
        (devKey && headerKey === devKey) ||
        (organizer?.apiKey && headerKey === organizer.apiKey)
      );

    if (!authorized) {
      return NextResponse.json(publicEvent);
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: { registeredAt: 'desc' },
      select: {
        email: true,
        paid: true,
        attended: true,
        registeredAt: true,
        scannedAt: true,
        qrToken: true,
        meta: true, // ← needed so admin table can show Name/Company
      },
    });

    return NextResponse.json({ ...publicEvent, registrations });
  } catch (e) {
    console.error('GET /api/events/[slug] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
