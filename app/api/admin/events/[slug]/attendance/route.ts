// app/api/admin/events/[slug]/attendance/route.ts
// app/api/admin/events/[slug]/attendance/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const event = await prisma.event.findUnique({
    where: { id: scope.eventId },
    select: { id: true, capacity: true },
  });
  if (!event) return NextResponse.json({ ok: false, error: 'Event not found' }, { status: 404 });

  const [total, attended, checkedOut] = await Promise.all([
    prisma.registration.count({ where: { eventId: event.id } }),
    prisma.registration.count({ where: { eventId: event.id, attended: true } }),
    prisma.registration.count({ where: { eventId: event.id, checkedOutAt: { not: null } } }),
  ]);

  return NextResponse.json({
    ok: true,
    stats: {
      total,
      attended,
      noShows: Math.max(0, total - attended),
      checkedOut,
      capacity: event.capacity ?? null,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
