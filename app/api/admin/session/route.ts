// app/api/admin/session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { key } -> set cookie if it matches ADMIN_KEY (or just set; gate validates later)
export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let body: any = {};
  if (ct.includes('application/json')) body = await req.json().catch(() => ({}));
  else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }
  const key = String(body.key ?? '').trim();
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });

  // Set httpOnly cookie; actual validation happens in gate() per-request
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_key', key, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}

// DELETE -> clear cookie
export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set('admin_key', '', { path: '/', maxAge: 0 });
  return res;
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
