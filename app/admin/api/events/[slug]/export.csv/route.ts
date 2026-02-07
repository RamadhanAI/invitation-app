// app/admin/api/events/[slug]/export.csv/route.ts
// app/admin/api/events/[slug]/export.csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function originFrom(req: Request) {
  return new URL(req.url).origin;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const target = `${originFrom(req)}/api/admin/events/${encodeURIComponent(params.slug)}/export.csv`;

  const resp = await fetch(target, {
    headers: { cookie: req.headers.get('cookie') ?? '' },
    cache: 'no-store',
  });

  const body = await resp.text();
  return new NextResponse(body, {
    status: resp.status,
    headers: {
      'content-type': resp.headers.get('content-type') || 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="registrations-${params.slug}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
