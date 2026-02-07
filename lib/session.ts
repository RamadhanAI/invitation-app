// lib/session.ts
// lib/session.ts
import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { cfg } from '@/lib/env';

export const ADMIN_COOKIE = 'inv_admin';
export const SCANNER_COOKIE = 'inv_scanner';

const SESSION_SECRET = cfg.SESSION_SECRET;
const SCANNER_SESSION_SECRET = cfg.SCANNER_SESSION_SECRET;

// 12h default
const DEFAULT_TTL = 60 * 60 * 12;
const SCANNER_TTL = 60 * 60 * 12;

export type AdminRole = 'superadmin' | 'admin' | 'editor' | 'scanner';
export type SessionKind = 'admin' | 'scanner';

export type SessionPayload = {
  u: string;
  k: SessionKind;
  role?: AdminRole;
  oid?: string;
  iat: number;
  exp: number;

  imp?: boolean;
  impTenantName?: string | null;
  impTenantStatus?: string | null;
};

// ------------------------------------------------------------
// Base64url helpers
// ------------------------------------------------------------
function b64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64UrlToString(b64u: string) {
  const s = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s.padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

// ------------------------------------------------------------
// ADMIN token (base64url payload + base64url HMAC)
// ------------------------------------------------------------
function signAdmin(p64: string) {
  return b64url(crypto.createHmac('sha256', SESSION_SECRET).update(p64).digest());
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const [p64, s64] = token.split('.');
    if (!p64 || !s64) return null;

    const expected = signAdmin(p64);
    if (!safeEqual(expected, s64)) return null;

    const payload = JSON.parse(fromB64UrlToString(p64)) as SessionPayload;

    const now = nowSec();
    if (!payload?.exp || now >= payload.exp) return null;

    if (payload.k !== 'admin') return null;
    if (typeof payload.u !== 'string' || !payload.u.trim()) return null;

    // role sanity (optional)
    if (payload.role && !['superadmin', 'admin', 'editor', 'scanner'].includes(payload.role)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * STRICT admin session:
 * - rejects scanner
 * - enforces tenant boundary (non-super must have oid)
 */
export function getAdminSession(): SessionPayload | null {
  const token = cookies().get(ADMIN_COOKIE)?.value || null;
  if (!token) return null;

  const p = verifyToken(token);
  if (!p) return null;

  if (p.role === 'scanner') return null;
  if (p.role !== 'superadmin' && !p.oid) return null;

  return p;
}

/**
 * LOOSE admin session:
 * - still verifies signature/exp/k/u
 * - DOES NOT enforce oid boundary
 * - still blocks scanner role
 *
 * Use for "system" routes like impersonation exit/restore.
 */
export function getAdminSessionLoose(): SessionPayload | null {
  const token = cookies().get(ADMIN_COOKIE)?.value || null;
  if (!token) return null;

  const p = verifyToken(token);
  if (!p) return null;

  if (p.role === 'scanner') return null;
  return p;
}

export function makeAdminToken(payload: Omit<SessionPayload, 'iat' | 'exp' | 'k'> & { exp?: number }) {
  const iat = nowSec();
  const exp = typeof payload.exp === 'number' ? payload.exp : iat + DEFAULT_TTL;

  const bodyObj: SessionPayload = {
    u: payload.u,
    k: 'admin',
    role: payload.role,
    oid: payload.oid,
    iat,
    exp,
    imp: payload.imp,
    impTenantName: payload.impTenantName ?? null,
    impTenantStatus: payload.impTenantStatus ?? null,
  };

  const p64 = b64url(Buffer.from(JSON.stringify(bodyObj), 'utf8'));
  const s64 = signAdmin(p64);
  return `${p64}.${s64}`;
}

// ------------------------------------------------------------
// SCANNER session (legacy hex HMAC)
// ------------------------------------------------------------
export type ScannerSessionPayload = {
  stationId: string;
  eventId: string;
  iat: number;
  exp?: number;
};

function hmacHex(input: string) {
  return crypto.createHmac('sha256', SCANNER_SESSION_SECRET).update(input).digest('hex');
}

function isHexSig(s: string) {
  return /^[0-9a-f]{64}$/i.test(s);
}

export function signSession(payload: Partial<ScannerSessionPayload>) {
  const iat = typeof payload.iat === 'number' ? payload.iat : nowSec();

  const bodyObj: ScannerSessionPayload = {
    stationId: String(payload.stationId || ''),
    eventId: String(payload.eventId || ''),
    iat,
    exp: typeof payload.exp === 'number' ? payload.exp : iat + SCANNER_TTL,
  };

  const body = b64url(Buffer.from(JSON.stringify(bodyObj), 'utf8'));
  const mac = hmacHex(body);
  return `${body}.${mac}`;
}

export function verifySession(token?: string | null): ScannerSessionPayload | null {
  try {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    if (!isHexSig(sig)) return null;

    const expected = hmacHex(body);
    if (!safeEqual(expected, sig)) return null;

    const payload = JSON.parse(fromB64UrlToString(body)) as ScannerSessionPayload;
    if (!payload?.stationId || !payload?.eventId) return null;

    const now = nowSec();
    if (payload.exp && now >= payload.exp) return null;

    if (payload.iat > 10_000_000_000) payload.iat = Math.floor(payload.iat / 1000);
    return payload;
  } catch {
    return null;
  }
}

export function getScannerSession(): ScannerSessionPayload | null {
  const token = cookies().get(SCANNER_COOKIE)?.value || null;
  return verifySession(token);
}
