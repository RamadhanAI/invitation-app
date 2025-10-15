// app/admin/api/events/[slug]/export.csv/route.ts
// app/admin/api/events/[slug]/export.csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE  = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  if (!ADMIN) return NextResponse.json({ error: 'ADMIN_KEY not set' }, { status: 500 });
  const target = `${BASE}/api/events/${encodeURIComponent(params.slug)}/export.csv`;
  const resp = await fetch(target, { headers: { 'x-api-key': ADMIN }, cache: 'no-store' });
  const body = await resp.text();
  return new NextResponse(body, {
    status: resp.status,
    headers: {
      'content-type': resp.headers.get('content-type') || 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${params.slug}-meta.csv"`,
      'cache-control': 'no-store',
    },
  });
}
