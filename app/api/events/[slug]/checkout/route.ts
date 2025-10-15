// app/api/events/[slug]/checkout/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  return NextResponse.json(
    { error: 'Payments are disabled in this environment.' },
    { status: 501 }
  );
}
