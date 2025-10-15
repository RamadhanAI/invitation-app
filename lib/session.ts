// lib/session.ts
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto'; // 👈 node:crypto
import { Buffer } from 'node:buffer';                       // 👈 node:buffer

const SECRET = process.env.SCANNER_SESSION_SECRET || 'dev-scan-secret';

export type SessionPayload = { stationId: string; eventId: string; iat: number };

function toBase64Url(str: string) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
function fromBase64UrlToString(b64url: string) {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}
function hmacHex(input: string) {
  return createHmac('sha256', SECRET).update(input).digest('hex');
}
function timingSafeEqualHex(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;

  // Casts only help TS; at runtime Buffer already is a Uint8Array
  const av = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bv = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return timingSafeEqual(av, bv);
}

export function signSession(payload: SessionPayload) {
  const body = toBase64Url(JSON.stringify(payload));
  const mac = hmacHex(body);
  return `${body}.${mac}`;
}

export function verifySession(token?: string): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expect = hmacHex(body);
  if (!timingSafeEqualHex(mac, expect)) return null;
  try {
    const json = fromBase64UrlToString(body);
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}
