import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const r = await fetch(`${BASE}/api/events/${encodeURIComponent(params.slug)}/attendance`, {
    headers: { 'x-api-key': ADMIN },
    cache: 'no-store',
  });
  const json = await r.json().catch(() => ({}));
  return NextResponse.json(json, { status: r.status });
}
