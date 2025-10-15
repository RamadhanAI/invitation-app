// lib/tokens.ts
// lib/tokens.ts
import * as jwt from 'jsonwebtoken';

const SECRET: jwt.Secret = process.env.TICKET_JWT_SECRET || 'dev-secret-change-me';

export type TicketPayload = {
  sub: string;
  eventId: string;
  email: string;
};

export function signTicket(
  payload: TicketPayload,
  opts?: { expiresIn?: string | number }
): string {
  if (!SECRET) throw new Error('TICKET_JWT_SECRET not configured');

  // Force TS to pick the options overload (not the callback one)
  const options: jwt.SignOptions = {
    algorithm: 'HS256' as jwt.Algorithm,
    // template-typed in v9; cast keeps both v8/v9 happy
    expiresIn: (opts?.expiresIn ?? '180d') as any,
  };

  return jwt.sign(payload as jwt.JwtPayload, SECRET, options);
}

export function verifyTicket(token: string): TicketPayload | null {
  try {
    const verified = jwt.verify(token, SECRET, {
      algorithms: ['HS256'] as jwt.Algorithm[],
      clockTolerance: 30 as any,
    }) as jwt.JwtPayload;
    // minimal cast back to your shape
    return verified as unknown as TicketPayload;
  } catch {
    return null;
  }
}

export function isLikelyJwt(token: string) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const b64url = /^[A-Za-z0-9\-_]+$/;
  return b64url.test(parts[0]) && b64url.test(parts[1]) && b64url.test(parts[2]);
}
