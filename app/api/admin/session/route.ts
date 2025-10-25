// app/api/admin/session/route.ts
// app/api/admin/session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getGlobalAdminKey(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_KEY ||
    process.env.ADMIN_KEY ||
    ''
  ).trim();
}

// GET -> check if current cookie matches global admin key
export async function GET() {
  const cookieKey = cookies().get('admin_key')?.value?.trim() || '';
  const valid = !!cookieKey && cookieKey === getGlobalAdminKey();
  return NextResponse.json({ ok: valid });
}

// POST { key } -> set admin_key cookie (doesn't validate here; per-request validation still happens)
export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let body: any = {};

  if (ct.includes('application/json')) {
    body = await req.json().catch(() => ({}));
  } else if (
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('multipart/form-data')
  ) {
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }

  const key = String(body.key ?? '').trim();
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

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

// OPTIONS -> allow preflight
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
