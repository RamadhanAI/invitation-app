// middleware.ts
import { NextResponse, NextRequest } from 'next/server';

const ADMIN_COOKIE = 'inv_admin';

// IMPORTANT: your station scanner cookie is scan_sess (per your note + route)
const SCAN_COOKIE = 'scan_sess';

const PROTECT_SCANNER = (process.env.PROTECT_SCANNER || '0') === '1';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';
const SCANNER_SESSION_SECRET = process.env.SCANNER_SESSION_SECRET || SESSION_SECRET;

type SessionKind = 'admin' | 'scanner';
type AdminRole = 'superadmin' | 'admin' | 'editor' | 'scanner';

type SessionPayload = {
  u?: string;
  k?: SessionKind;
  role?: AdminRole;
  oid?: string;
  iat?: number;
  exp?: number;
};

type ScannerSessionPayload = {
  stationId: string;
  eventId: string;
  iat: number;
  exp?: number;
};

const ROLE_SET = new Set<AdminRole>(['superadmin', 'admin', 'editor', 'scanner']);

function needsAdminAuth(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}

function needsScannerAuth(pathname: string) {
  // Only protect scanner UI if you explicitly enable it
  if (!PROTECT_SCANNER) return false;
  // Protect scanner pages except the login page itself (/scan)
  if (pathname === '/scan') return false;
  return pathname.startsWith('/scan/');
}

function b64urlToUint8(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const str = atob(s);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

function decodeB64urlJson(p64: string): any | null {
  try {
    const json = atob(
      p64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p64.length / 4) * 4, '=')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidRole(v: unknown): v is AdminRole {
  return typeof v === 'string' && ROLE_SET.has(v as AdminRole);
}

// ------------------------------------------------------------
// ADMIN verify (payloadB64url.signatureB64url)
// ------------------------------------------------------------
async function verifyAdmin(token: string): Promise<SessionPayload | null> {
  try {
    const [p64, s64] = token.split('.');
    if (!p64 || !s64) return null;

    const webCrypto = globalThis.crypto;
    if (!webCrypto?.subtle) return null;

    const key = await webCrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(p64);
    const sig = b64urlToUint8(s64);

    const ok = await webCrypto.subtle.verify({ name: 'HMAC' }, key, sig, data);
    if (!ok) return null;

    const payload = decodeB64urlJson(p64) as SessionPayload | null;
    if (!payload) return null;

    if (!isNonEmptyString(payload.u)) return null;
    if (payload.k !== 'admin') return null;
    if (payload.role !== undefined && !isValidRole(payload.role)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || now >= payload.exp) return null;

    // Block scanner role from admin session
    if (payload.role === 'scanner') return null;

    return payload;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// LEGACY SCANNER verify (bodyB64url.macHex) for scan_sess
// Matches lib/session.ts signSession() format
// ------------------------------------------------------------
function isHexSig(s: string) {
  return /^[0-9a-f]{64}$/i.test(s);
}

async function hmacHexEdge(secret: string, input: string): Promise<string | null> {
  try {
    const webCrypto = globalThis.crypto;
    if (!webCrypto?.subtle) return null;

    const key = await webCrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuf = await webCrypto.subtle.sign(
      { name: 'HMAC' },
      key,
      new TextEncoder().encode(input)
    );

    // Convert ArrayBuffer -> hex
    const bytes = new Uint8Array(sigBuf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex;
  } catch {
    return null;
  }
}

async function verifyScannerLegacy(token: string): Promise<ScannerSessionPayload | null> {
  try {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    if (!isHexSig(mac)) return null;

    const expected = await hmacHexEdge(SCANNER_SESSION_SECRET, body);
    if (!expected) return null;

    // timingSafe-ish compare in Edge: compare strings length + constant-ish loop
    if (expected.length !== mac.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
    if (diff !== 0) return null;

    const payload = decodeB64urlJson(body) as ScannerSessionPayload | null;
    if (!payload?.stationId || !payload?.eventId) return null;

    return payload;
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ---- ADMIN protection ----
  if (needsAdminAuth(pathname)) {
    const adminToken = req.cookies.get(ADMIN_COOKIE)?.value || null;
    const admin = adminToken ? await verifyAdmin(adminToken) : null;

    // /api/admin → JSON 401
    if (pathname.startsWith('/api/admin')) {
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const headers = new Headers(req.headers);
      headers.set('x-admin-user', String(admin.u));
      headers.set('x-admin-role', String(admin.role || 'admin'));
      if (admin.oid) headers.set('x-oid', String(admin.oid));
      if (admin.role === 'superadmin') headers.set('x-superadmin', '1');

      return NextResponse.next({ request: { headers } });
    }

    // /admin → redirect to /login
    if (pathname.startsWith('/admin')) {
      if (admin) return NextResponse.next();
      const url = new URL('/login', req.url);
      url.searchParams.set('next', pathname + (search || ''));
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // ---- OPTIONAL SCANNER UI protection (only if enabled) ----
  if (needsScannerAuth(pathname)) {
    const scanToken = req.cookies.get(SCAN_COOKIE)?.value || null;
    const scan = scanToken ? await verifyScannerLegacy(scanToken) : null;

    if (!scan) {
      // Kick back to /scan (scanner login UI)
      const url = new URL('/scan', req.url);
      url.searchParams.set('next', pathname + (search || ''));
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/scan', '/scan/:path*'],
};
