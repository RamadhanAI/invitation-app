// app/api/auth/scanner-login/route.ts
import { NextResponse } from 'next/server';
import { authenticateStationScanner, authenticateScannerEnv } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
  const code       = form.get('code')?.toString() || '';
  const secret     = form.get('secret')?.toString() || '';
  const scannerKey = form.get('scannerKey')?.toString() || '';
  const next       = (form.get('next')?.toString() || '/scan').trim();

  if (code && secret) {
    const res = await authenticateStationScanner({ code, secret });
    const dest = res.ok
      ? new URL(next || '/scan', req.url)
      : new URL(`/scanner-login?err=station&next=${encodeURIComponent(next)}`, req.url);
    return NextResponse.redirect(dest);
  }

  if (scannerKey) {
    const res = await authenticateScannerEnv(scannerKey);
    const dest = res.ok
      ? new URL(next || '/scan', req.url)
      : new URL(`/scanner-login?err=env&next=${encodeURIComponent(next)}`, req.url);
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL(`/scanner-login?err=missing&next=${encodeURIComponent(next)}`, req.url));
}
