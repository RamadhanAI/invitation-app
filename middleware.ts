// middleware.ts
// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const ADMIN_COOKIE = 'inv_admin';
const SCANNER_COOKIE = 'inv_scanner';
const PROTECT_SCANNER = (process.env.PROTECT_SCANNER || '0') === '1';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

function needsAuth(pathname: string) {
  if (pathname.startsWith('/admin')) return true;
  if (PROTECT_SCANNER && (pathname === '/scan' || pathname.startsWith('/scan/'))) return true;
  return false;
}

// base64url -> Uint8Array (for signature only)
function b64urlToUint8(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const str = atob(s);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

// ✅ Verify HMAC over the *p64 string itself* (matches the login route)
async function verify(token: string) {
  try {
    const [p64, s64] = token.split('.');
    if (!p64 || !s64) return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(p64);   // ← FIXED (was b64urlToUint8(p64))
    const sig  = b64urlToUint8(s64);
    const ok = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!ok) return null;

    // Now safely decode the payload (only *after* signature passes)
    const payloadJson = atob(p64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p64.length / 4) * 4, '='));
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.exp || now >= payload.exp) return null;
    return payload; // { u, k, iat, exp }
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!needsAuth(pathname)) return NextResponse.next();

  const adminToken = req.cookies.get(ADMIN_COOKIE)?.value || null;
  const scannerToken = req.cookies.get(SCANNER_COOKIE)?.value || null;

  const isAdmin = adminToken ? await verify(adminToken) : null;
  const isScanner = scannerToken ? await verify(scannerToken) : null;

  if (pathname.startsWith('/admin')) {
    if (isAdmin) return NextResponse.next();
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  if (pathname === '/scan' || pathname.startsWith('/scan/')) {
    if (!PROTECT_SCANNER) return NextResponse.next();
    if (isAdmin || isScanner) return NextResponse.next();
    const url = new URL('/scanner-login', req.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/scan', '/scan/:path*'],
};
