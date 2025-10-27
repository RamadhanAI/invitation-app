// lib/adminSession.ts
import { getSessionCookie, verifyToken } from '@/lib/auth';

// Shape when admin is valid
export type AdminSessionOK = {
  ok: true;
  user: string;
  exp: number;
  iat: number;
};

// Shape when admin is NOT valid
export type AdminSessionBad = {
  ok: false;
  reason:
    | 'missing'
    | 'format'
    | 'bad-signature'
    | 'expired'
    | 'exception'
    | 'not-admin'
    | 'invalid-payload';
};

/**
 * readAdminSessionFromCookies
 *
 * - Reads the `inv_admin` cookie via getSessionCookie('admin')
 * - Verifies HMAC signature against SESSION_SECRET
 * - Confirms the payload is actually an admin session (k === "admin")
 *
 * Returns a structured { ok: true, user, exp, iat } if valid
 * or { ok: false, reason: ... } if not.
 */
export function readAdminSessionFromCookies():
  | AdminSessionOK
  | AdminSessionBad {
  const raw = getSessionCookie('admin'); // 'inv_admin' cookie from lib/auth.ts
  const secret = process.env.SESSION_SECRET || 'change-me';

  const v = verifyToken(raw, secret);
  if (!v.ok) {
    return { ok: false, reason: v.reason };
  }

  const p: any = v.payload || {};
  // must be explicitly an admin session
  if (p.k !== 'admin') {
    return { ok: false, reason: 'not-admin' };
  }
  if (typeof p.u !== 'string') {
    return { ok: false, reason: 'invalid-payload' };
  }
  if (typeof p.exp !== 'number' || typeof p.iat !== 'number') {
    return { ok: false, reason: 'invalid-payload' };
  }

  return {
    ok: true,
    user: p.u,
    exp: p.exp,
    iat: p.iat,
  };
}

/**
 * Convenience helper for API routes/pages
 * Returns the admin username string if valid, or null if not.
 */
export function getAdminUsernameOrNull(): string | null {
  const r = readAdminSessionFromCookies();
  return r.ok ? r.user : null;
}
