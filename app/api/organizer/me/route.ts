// app/api/organizer/me/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  const key = req.headers.get('x-api-key') ?? '';
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizer = await prisma.organizer.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true, email: true, brand: true },
  });

  if (!organizer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ organizer });
}
