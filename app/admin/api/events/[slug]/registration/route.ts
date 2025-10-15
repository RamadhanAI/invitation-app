// Forwards admin calls to the secured /api/events/[slug]/registration route
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  return base ? `${base}${path}` : `http://localhost:3000${path}`;
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const adminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
  if (!adminKey) return NextResponse.json({ error: 'Admin key missing' }, { status: 500 });

  const body = await req.text(); // keep raw for pass-through
  const res = await fetch(absoluteUrl(`/api/events/${encodeURIComponent(params.slug)}/registration`), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-api-key': adminKey },
    body,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status, headers: { 'cache-control': 'no-store' } });
}
