// app/api/admin/events/[slug]/export.csv/route.ts
// app/api/admin/events/[slug]/export.csv/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  if (!ADMIN) return NextResponse.json({ error: 'ADMIN_KEY not set' }, { status: 500 });

  const origin = new URL(req.url).origin;
  const base = process.env.NEXT_PUBLIC_APP_URL || origin;

  const r = await fetch(`${base}/api/events/${encodeURIComponent(params.slug)}/export.csv`, {
    headers: { 'x-api-key': ADMIN },
    cache: 'no-store',
  });

  const text = await r.text();
  const headers = new Headers();
  headers.set('content-type', r.headers.get('content-type') || 'text/csv; charset=utf-8');
  headers.set('content-disposition', `attachment; filename="registrations-${params.slug}.csv"`);
  headers.set('cache-control', 'no-store');

  return new NextResponse(text, { status: r.status, headers });
}
