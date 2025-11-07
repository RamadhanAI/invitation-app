// app/api/qr/route.ts
import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = url.searchParams.get('data') || '';
  const size = Math.min(Math.max(parseInt(url.searchParams.get('size') || '380', 10), 100), 2000);
  const margin = Math.max(parseInt(url.searchParams.get('margin') || '0', 10), 0);

  if (!data) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 });
  }

  const png = await QRCode.toBuffer(data, {
    type: 'png',
    width: size,
    margin,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return new NextResponse(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
    },
  });
}
