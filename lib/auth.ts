// lib/auth.ts
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifySecret } from '@/lib/password';

/**
 * Admin: env-based today (ADMIN_USER / ADMIN_PASS)
 * Scanner: prefer Station(code+secret) from DB; optional fallback to SCANNER_KEY
 * Sessions are HMAC tokens in HttpOnly cookies, verified by middleware.
 */

const ADMIN_COOKIE = 'inv_admin';
const SCANNER_COOKIE = 'inv_scanner';
const DEFAULT_TTL = 60 * 60 * 12; // 12 hours

// ── helpers ──────────────────────────────────────────────────────────────────
function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64');
}
function sign(payloadB64: string, secret: string) {
  return b64url(crypto.createHmac('sha256', secret).update(payloadB64).digest());
}
// Convert Buffer → Uint8Array view for timingSafeEqual
function toView(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
export function safeEqual(a?: string | null, b?: string | null) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(toView(aBuf), toView(bBuf));
}

// ── sessions ─────────────────────────────────────────────────────────────────
export type SessionKind = 'admin' | 'scanner';

export async function createSession(kind: SessionKind, username: string, ttlSeconds = DEFAULT_TTL) {
  const secret = process.env.SESSION_SECRET || 'change-me';
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const payload = { u: username, iat: now, exp, k: kind };
  const p64 = b64url(Buffer.from(JSON.stringify(payload)));
  const s64 = sign(p64, secret);
  const token = `${p64}.${s64}`;

  const name = kind === 'admin' ? ADMIN_COOKIE : SCANNER_COOKIE;
  cookies().set({
    name,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds,
  });
  return token;
}

export async function clearSession(kind: SessionKind) {
  const name = kind === 'admin' ? ADMIN_COOKIE : SCANNER_COOKIE;
  cookies().set({
    name,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function getSessionCookie(kind: SessionKind) {
  const name = kind === 'admin' ? ADMIN_COOKIE : SCANNER_COOKIE;
  return cookies().get(name)?.value || null;
}

export function verifyToken(token: string | null, secret: string) {
  try {
    if (!token) return { ok: false, reason: 'missing' as const };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'format' as const };
    const [p64, s64] = parts;

    const expected = sign(p64, secret);
    const expBuf = Buffer.from(expected, 'utf8');
    const gotBuf = Buffer.from(s64, 'utf8');
    if (expBuf.length !== gotBuf.length || !crypto.timingSafeEqual(toView(expBuf), toView(gotBuf))) {
      return { ok: false, reason: 'bad-signature' as const };
    }

    const payload = JSON.parse(b64urlDecode(p64).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload?.exp !== 'number' || now >= payload.exp) {
      return { ok: false, reason: 'expired' as const };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: 'exception' as const };
  }
}

// ── today’s admin login (env) ────────────────────────────────────────────────
export async function authenticateAdmin(identifier: string, password: string) {
  const envUser = process.env.ADMIN_USER || 'admin';
  const envPass = process.env.ADMIN_PASS || 'admin123';
  if (safeEqual(identifier, envUser) && safeEqual(password, envPass)) {
    await createSession('admin', identifier);
    return { ok: true as const };
  }
  return { ok: false as const, error: 'Invalid credentials' };
}

// ── scanners: Station (DB) or env key ────────────────────────────────────────
export async function authenticateStationScanner(input: { code: string; secret: string; eventId?: string }) {
  const where: any = { code: input.code, active: true };
  if (input.eventId) where.eventId = input.eventId;

  const station = await prisma.station.findFirst({
    where,
    select: { id: true, name: true, eventId: true, secretHash: true },
  });
  if (!station) return { ok: false as const, error: 'Invalid code' };

  const hash = station.secretHash || '';
  let ok = await verifySecret(input.secret, hash); // scrypt + bcrypt fallback
  // If you still have any plaintext rows (not recommended), allow one-time success:
  if (!ok && !hash.startsWith('scrypt$') && !hash.startsWith('$2')) {
    ok = safeEqual(input.secret, hash);
  }
  if (!ok) return { ok: false as const, error: 'Invalid secret' };

  await createSession('scanner', `station:${station.name}`);
  return { ok: true as const, stationId: station.id, eventId: station.eventId, name: station.name };
}

// 2) Global env-based demo key (optional fallback)
export async function authenticateScannerEnv(key: string) {
  const expected = process.env.SCANNER_KEY || '';
  if (expected && safeEqual(key, expected)) {
    await createSession('scanner', 'scanner');
    return { ok: true as const };
  }
  return { ok: false as const, error: 'Invalid scanner key' };
}
