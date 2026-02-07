// app/api/admin/tenants/[id]/impersonate/route.ts
// app/api/admin/tenants/[id]/impersonate/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_COOKIE = 'inv_admin';
const PREV_COOKIE = 'inv_admin_prev';
const DEFAULT_TTL = 60 * 60 * 12;

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function sign(p64: string, secret: string) {
  return b64url(crypto.createHmac('sha256', secret).update(p64).digest());
}

function safeRedirect(input: string | null) {
  const v = (input || '').trim() || '/admin';
  if (!v.startsWith('/')) return '/admin';
  return v;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const sess = getAdminSession();
  if (!sess) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (sess.role !== 'superadmin') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const tenantId = (ctx?.params?.id || '').trim();
  if (!tenantId) return NextResponse.json({ ok: false, error: 'Missing tenant id' }, { status: 400 });

  const url = new URL(req.url);
  const redirectTo = safeRedirect(url.searchParams.get('redirect'));

  const org = await prisma.organizer.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true },
  });
  if (!org) return NextResponse.json({ ok: false, error: 'Tenant not found' }, { status: 404 });

  const u = await prisma.organizerUser.findFirst({
    where: { organizerId: tenantId, role: { in: ['admin', 'editor'] } },
    orderBy: { createdAt: 'asc' },
    select: { email: true, role: true },
  });

  const secret = (process.env.SESSION_SECRET || 'change-me').trim();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + DEFAULT_TTL;

  const jar = cookies();
  const currentToken = jar.get(ADMIN_COOKIE)?.value || '';
  const alreadyPrev = jar.get(PREV_COOKIE)?.value || '';

  const res = NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 });

  if (currentToken && !alreadyPrev) {
    res.cookies.set({
      name: PREV_COOKIE,
      value: currentToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEFAULT_TTL,
    });
  }

  const payload: any = {
    u: u?.email || `impersonated@${org.id}`,
    iat: now,
    exp,
    k: 'admin',
    role: u?.role || 'admin',
    oid: org.id,

    // ✅ impersonation marker
    imp: true,
    impTenantName: org.name || null,
    impTenantStatus: org.status || null,
  };

  const p64 = b64url(Buffer.from(JSON.stringify(payload)));
  const s64 = sign(p64, secret);

  res.cookies.set({
    name: ADMIN_COOKIE,
    value: `${p64}.${s64}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DEFAULT_TTL,
  });

  return res;
}
