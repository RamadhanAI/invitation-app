// app/api/admin/events/route.ts
// app/api/admin/events/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

function baseFrom(req: Request) {
  // Prefer configured base; fall back to request origin
  const origin = new URL(req.url).origin;
  return process.env.NEXT_PUBLIC_APP_URL || origin;
}

// ---------- GET: list events via admin ----------
export async function GET(req: Request) {
  if (!ADMIN) return NextResponse.json({ error: 'ADMIN_KEY not set' }, { status: 500 });

  const base = baseFrom(req);
  let r: Response;
  try {
    r = await fetch(`${base}/api/events`, {
      headers: { 'x-api-key': ADMIN },
      cache: 'no-store',
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Upstream fetch failed', detail: String(e?.message || e) }, { status: 502 });
  }

  const text = await r.text().catch(() => '');
  const type = r.headers.get('content-type') || '';
  const body = type.includes('application/json') ? JSON.parse(text || '{}') : text;

  return NextResponse.json(body, { status: r.status });
}

// ---------- POST: create event via admin ----------
export async function POST(req: Request) {
  if (!ADMIN) return NextResponse.json({ error: 'ADMIN_KEY not set' }, { status: 500 });
  const base = baseFrom(req);

  let payload: any = {};
  try { payload = await req.json(); } catch {}

  let r: Response;
  try {
    r = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ADMIN,
      },
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Upstream fetch failed', detail: String(e?.message || e) }, { status: 502 });
  }

  // Pass through response (JSON or text) so the UI shows the real error
  const text = await r.text().catch(() => '');
  const type = r.headers.get('content-type') || '';
  const headers = new Headers();
  headers.set('cache-control', 'no-store');
  if (type) headers.set('content-type', type);

  return new NextResponse(text, { status: r.status, headers });
}
