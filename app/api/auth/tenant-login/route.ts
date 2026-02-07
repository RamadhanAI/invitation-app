// app/api/auth/tenants-login/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/password';

export const runtime = 'nodejs';

const ADMIN_COOKIE = 'inv_admin';
const DEFAULT_TTL = 60 * 60 * 12;

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function sign(p64: string, secret: string) {
  return b64url(crypto.createHmac('sha256', secret).update(p64).digest());
}

export async function POST(req: Request) {
  const form = await req.formData();
  const identifier = (form.get('identifier')?.toString() ?? '').trim();
  const password = (form.get('password')?.toString() ?? '').trim();
  const next = (form.get('next')?.toString() ?? '/admin').trim();

  if (!identifier || !password) {
    const dest = new URL(`/login?err=1&next=${encodeURIComponent(next)}`, req.url);
    return NextResponse.redirect(dest, { status: 303 });
  }

  const secret = (process.env.SESSION_SECRET || 'change-me').trim();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + DEFAULT_TTL;

  const user = await prisma.organizerUser.findFirst({
    where: { email: { equals: identifier, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      role: true,
      organizerId: true,
      passwordHash: true,
      isActive: true,
      organizer: { select: { status: true } }, // enforce tenant status
    },
  });

  const organizerStatus = user?.organizer?.status ?? null;

  let ok = false;
  if (
    user?.isActive === true &&
    organizerStatus === 'active' &&
    typeof user.passwordHash === 'string' &&
    user.passwordHash.length > 10
  ) {
    ok = await verifyPassword(password, user.passwordHash);
  }

  const errCode = user && organizerStatus !== 'active' ? '2' : '1';
  const dest = new URL(
    ok ? (next || '/admin') : `/login?err=${errCode}&next=${encodeURIComponent(next)}`,
    req.url
  );

  const res = NextResponse.redirect(dest, { status: 303 });

  if (ok && user) {
    void prisma.organizerUser
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {});

    const payload = {
      u: user.email,
      iat: now,
      exp,
      k: 'admin',
      role: (user.role || 'admin') as string,
      oid: user.organizerId,
    };

    const p64 = b64url(Buffer.from(JSON.stringify(payload)));
    const s64 = sign(p64, secret);
    const token = `${p64}.${s64}`;

    res.cookies.set({
      name: ADMIN_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEFAULT_TTL,
    });
  }

  return res;
}
