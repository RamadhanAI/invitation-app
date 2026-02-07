// app/api/auth/scanner-login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { signSession } from '@/lib/session';
import { verifySecret } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'scan_sess';
const TTL = 60 * 60 * 8;

function redirectWithErr(req: Request, next: string, err: string) {
  const url = new URL(`/scanner-login?err=${encodeURIComponent(err)}&next=${encodeURIComponent(next)}`, req.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(req: Request) {
  const form = await req.formData();

  const next = (form.get('next')?.toString() ?? '/scan').trim() || '/scan';

  const eventSlug = (form.get('eventSlug')?.toString() ?? '').trim();
  const code = (form.get('code')?.toString() ?? '').trim();
  const secret = (form.get('secret')?.toString() ?? '').trim();
  const scannerKey = (form.get('scannerKey')?.toString() ?? '').trim();

  const envScannerKey = (process.env.SCANNER_KEY || process.env.SCANNER_SECRET || '').trim();

  const usingStation = !!(eventSlug && code && secret);
  const usingGlobal = !!scannerKey;

  if (!usingStation && !usingGlobal) {
    return redirectWithErr(req, next, 'missing');
  }

  // ------------------------------------------------------------
  // Option A: Global scanner key
  // ------------------------------------------------------------
  if (usingGlobal) {
    if (!envScannerKey || scannerKey !== envScannerKey) {
      return redirectWithErr(req, next, 'env');
    }

    // "Global scanner" needs a scope. We can’t issue a station session without stationId/eventId.
    // So global key should still require selecting a station or event in UI.
    // If you truly want global key to bypass station selection, you need a different session model.
    //
    // For now, we enforce station mode for actual scanning session.
    return redirectWithErr(req, next, 'missing');
  }

  // ------------------------------------------------------------
  // Option B: Station credentials (recommended)
  // ------------------------------------------------------------
  const event = await prisma.event.findUnique({
    where: { slug: String(eventSlug) },
    select: { id: true },
  });
  if (!event) return redirectWithErr(req, next, 'station');

  const station = await prisma.station.findUnique({
    where: { station_event_code: { eventId: event.id, code: String(code) } },
    select: { id: true, active: true, secretHash: true },
  });

  if (!station || !station.active) return redirectWithErr(req, next, 'station');

  const ok = await verifySecret(String(secret), station.secretHash);
  if (!ok) return redirectWithErr(req, next, 'station');

  // Set scanner cookie (legacy hex HMAC format via signSession)
  const value = signSession({
    stationId: station.id,
    eventId: event.id,
    iat: Math.floor(Date.now() / 1000),
  });

  cookies().set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TTL,
  });

  return NextResponse.redirect(new URL(next, req.url), { status: 303 });
}
