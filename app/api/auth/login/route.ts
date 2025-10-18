// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';

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
  const identifier = form.get('identifier')?.toString() ?? '';
  const password   = form.get('password')?.toString()   ?? '';
  const next       = (form.get('next')?.toString()      ?? '/admin').trim();

  const envUser = process.env.ADMIN_USER || 'admin';
  const envPass = process.env.ADMIN_PASS || 'admin123';
  const ok = identifier === envUser && password === envPass;

  const dest = new URL(ok ? (next || '/admin') : `/login?err=1&next=${encodeURIComponent(next)}`, req.url);
  const res = NextResponse.redirect(dest, { status: 303 });

  if (ok) {
    const secret = process.env.SESSION_SECRET || 'change-me';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + DEFAULT_TTL;
    const payload = { u: identifier, iat: now, exp, k: 'admin' };
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

export const runtime = 'nodejs';
