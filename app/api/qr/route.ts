// app/api/qr/route.ts
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = url.searchParams.get('data') ?? '';
  const size = Math.max(64, Math.min(1024, Number(url.searchParams.get('size') ?? 320)));
  const margin = Math.max(0, Math.min(8, Number(url.searchParams.get('margin') ?? 0)));
  if (!data) return NextResponse.json({ ok:false, error: 'Missing ?data' }, { status: 400 });

  try {
    const svg = await QRCode.toString(data, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin,
      width: size,
    });
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok:false, error: 'QR encode failed' }, { status: 500 });
  }
}
