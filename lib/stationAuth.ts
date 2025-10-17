// lib/stationAuth.ts
import * as crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifySecret } from '@/lib/password';

const COOKIE = 'station';
const SECRET = (process.env.SCANNER_SECRET || process.env.ADMIN_KEY || 'dev-secret').trim();

// Tiny HMAC-signed token (no extra deps)
function sign(payload: object, expSec = 3600 * 24 * 7) {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + expSec };
  const b64  = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}
function verify(token?: string): null | any {
  if (!token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(b64).digest('base64url');
  if (good !== sig) return null;
  const data = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
  return data;
}

export async function createStationSession(stationId: string, eventId: string, name: string) {
  const token = sign({ stationId, eventId, name });
  cookies().set({
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearStationSession() {
  cookies().set(COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
}

export async function getStationFromSession() {
  const cookie = cookies().get(COOKIE)?.value;
  const claims = verify(cookie);
  if (!claims) return null;

  const st = await prisma.station.findUnique({
    where: { id: claims.stationId },
    select: { id: true, name: true, eventId: true, active: true },
  });
  if (!st || !st.active) return null;
  return st; // { id, name, eventId }
}

export async function verifyStationLogin(eventSlug: string, code: string, secret: string) {
  const event = await prisma.event.findUnique({ where: { slug: eventSlug }, select: { id: true } });
  if (!event) throw new Error('Event not found');

  const station = await prisma.station.findFirst({
    where: { eventId: event.id, code },
    select: { id: true, name: true, eventId: true, secretHash: true, active: true },
  });
  if (!station || !station.active) throw new Error('Invalid station');

  const ok = await verifySecret(secret, station.secretHash);
  if (!ok) throw new Error('Invalid station');
  return station;
}
