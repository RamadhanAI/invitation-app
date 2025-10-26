// app/api/admin/session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'admin_key';

// helper: check if a provided key is valid
function isValidAdminKey(k: string | undefined | null): boolean {
  if (!k) return false;
  const input = k.trim();
  if (!input) return false;

  const globalKey =
    (process.env.NEXT_PUBLIC_ADMIN_KEY ||
      process.env.ADMIN_KEY ||
      ''
    ).trim();

  if (globalKey && input === globalKey) return true;

  // NOTE:
  // We could also allow organizer.apiKey here, but that requires event context.
  // For dashboard-wide auth we only bless the global key.
  return false;
}

// GET -> are we authorized?
export async function GET() {
  const cookieVal = cookies().get(COOKIE_NAME)?.value || '';
  if (isValidAdminKey(cookieVal)) {
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

// POST { key } -> validate, then set cookie if valid
export async function POST(req: Request) {
  // support both JSON and form encodes
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

  // Only set cookie if this key is actually valid
  if (!isValidAdminKey(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, key, {
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
  res.cookies.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
  });
  return res;
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
