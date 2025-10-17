// app/api/auth/scanner-login/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { authenticateStationScanner, authenticateScannerEnv } from '@/lib/auth';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// --- optional: very light rate limit per IP (60 attempts / 5 min) ---
const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
const redisTok = process.env.UPSTASH_REDIS_REST_TOKEN!;
const rl = (redisUrl && redisTok)
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl, token: redisTok }),
      limiter: Ratelimit.slidingWindow(60, '5 m'),
      prefix: 'scanner-login',
    })
  : null;

// only allow redirecting within our own origin or explicit allowlist
function safeNext(url: string, fallback: string, reqOrigin: string) {
  try {
    const u = new URL(url, reqOrigin);
    // same-origin? ok
    if (u.origin === reqOrigin) return u.toString();
    // allowlist more origins if needed:
    return new URL(fallback, reqOrigin).toString();
  } catch {
    return new URL(fallback, reqOrigin).toString();
  }
}

export async function POST(req: Request) {
  const form = await req.formData();

  const code       = (form.get('code')?.toString() ?? '').trim();
  const secret     = (form.get('secret')?.toString() ?? '').trim();
  const scannerKey = (form.get('scannerKey')?.toString() ?? '').trim();
  const nextPath   = (form.get('next')?.toString() ?? '/scan').trim();

  const reqUrl = new URL(req.url);
  const nextUrl = safeNext(nextPath, '/scan', reqUrl.origin);

  // optional: rate limit by IP
  if (rl) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown';
    const { success } = await rl.limit(`scanner:${ip}`);
    if (!success) {
      const dest = new URL(`/scanner-login?err=rate&next=${encodeURIComponent(nextUrl)}`, reqUrl);
      return NextResponse.redirect(dest, { status: 303 });
    }
  }

  // Station code + secret flow
  if (code && secret) {
    const res = await authenticateStationScanner({ code, secret });
    const dest = res.ok
      ? new URL(nextUrl)
      : new URL(`/scanner-login?err=station&next=${encodeURIComponent(nextUrl)}`, reqUrl);
    return NextResponse.redirect(dest, { status: 303 });
  }

  // Env key fallback flow
  if (scannerKey) {
    const res = await authenticateScannerEnv(scannerKey);
    const dest = res.ok
      ? new URL(nextUrl)
      : new URL(`/scanner-login?err=env&next=${encodeURIComponent(nextUrl)}`, reqUrl);
    return NextResponse.redirect(dest, { status: 303 });
  }

  // Missing fields
  return NextResponse.redirect(
    new URL(`/scanner-login?err=missing&next=${encodeURIComponent(nextUrl)}`, reqUrl),
    { status: 303 }
  );
}
