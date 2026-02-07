// app/api/organizer/me/route.ts
// app/api/organizer/me/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const key = (req.headers.get('x-api-key') ?? '').trim();
  if (!key) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const organizer = await prisma.organizer.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true, email: true, brand: true },
  });

  if (!organizer) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ ok: true, organizer });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
