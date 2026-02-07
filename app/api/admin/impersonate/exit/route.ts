// app/api/admin/impersonate/exit/route.ts
// app/api/admin/impersonate/exit/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSessionLoose } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'inv_admin';
const PREV_COOKIE = 'inv_admin_prev';
const DEFAULT_TTL = 60 * 60 * 12;

function safeRedirect(v: string | null) {
  const p = (v || '').trim() || '/admin/tenants';
  return p.startsWith('/') ? p : '/admin/tenants';
}

function handler(req: Request) {
  const jar = cookies();
  const prev = jar.get(PREV_COOKIE)?.value || '';
  const sess = getAdminSessionLoose();

  // allow restore even if current cookie is busted (prev exists)
  if (!sess && !prev) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const redirectTo = safeRedirect(url.searchParams.get('redirect'));

  // no prev => nothing to restore, just go back
  if (!prev) {
    return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });
  }

  const res = NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });

  // restore superadmin cookie
  res.cookies.set({
    name: ADMIN_COOKIE,
    value: prev,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEFAULT_TTL,
  });

  // clear prev
  res.cookies.set({
    name: PREV_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return res;
}

export async function GET(req: Request) {
  return handler(req);
}

export async function POST(req: Request) {
  return handler(req);
}
