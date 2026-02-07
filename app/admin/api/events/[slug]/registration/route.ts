// Forwards admin calls to the secured /api/events/[slug]/registration route
// app/admin/api/events/[slug]/registration/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: Request) {
  return new URL(req.url).origin;
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const target = `${originFrom(req)}/api/admin/events/${encodeURIComponent(params.slug)}/registration`;
  const body = await req.text();

  const res = await fetch(target, {
    method: 'PATCH',
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      cookie: req.headers.get('cookie') ?? '',
    },
    body,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status, headers: { 'cache-control': 'no-store' } });
}
