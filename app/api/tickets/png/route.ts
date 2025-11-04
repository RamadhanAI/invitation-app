// app/api/ticket/png/route.ts
// app/api/ticket/png/route.ts
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
}
function clampInt(raw: string | null, def: number, min: number, max: number) {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token')?.trim();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const name    = url.searchParams.get('name')    ?? 'FULL NAME';
    const title   = url.searchParams.get('title')   ?? 'JOB TITLE';
    const company = url.searchParams.get('company') ?? 'COMPANY NAME';
    const label   = (url.searchParams.get('label')  ?? 'ATTENDEE').toUpperCase(); // never VISITOR

    const eventLine1 = url.searchParams.get('eventTitle') ?? '';
    const eventLine2 = url.searchParams.get('eventTime')  ?? '';

    const headFrom = url.searchParams.get('headFrom') ?? '#C7FF65';
    const headTo   = url.searchParams.get('headTo')   ?? '#00D1FF';
    const ribbonBg = url.searchParams.get('ribbonBg') ?? '#2F2CB7';
    const ribbonFg = url.searchParams.get('ribbonFg') ?? '#FFFFFF';

    const width = clampInt(url.searchParams.get('width'), 900, 480, 2200);
    const dpi   = clampInt(url.searchParams.get('dpi'), 300, 72, 600);

    const pad     = Math.round(width * 0.06);
    const headerH = Math.round(width * 0.11);
    const qrSize  = Math.round(width * 0.38);
    const height  = Math.round(width * 1.45);

    const qrSvgRaw = await QRCode.toString(token, { type: 'svg', errorCorrectionLevel: 'M', margin: 0 });
    const qrInner = qrSvgRaw.replace(/<\?xml[^>]*>/, '').replace('<svg', `<svg width="${qrSize}" height="${qrSize}" shape-rendering="crispEdges"`);

    const showEvent = Boolean(eventLine1 || eventLine2);
    const eventBlockH = showEvent ? Math.round(width * 0.14) : 0;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="head" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${esc(headFrom)}" />
      <stop offset="100%" stop-color="${esc(headTo)}" />
    </linearGradient>
    <linearGradient id="sheenGrad" gradientTransform="rotate(30)">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0" />
      <stop offset="50%"  stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="${Math.round(width*0.05)}" fill="#FFFFFF" stroke="#E5E7EB"/>
  <rect x="0" y="0" width="${width}" height="${headerH}" fill="url(#head)"/>
  <text x="${width/2}" y="${Math.round(headerH*0.68)}" text-anchor="middle"
        font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
        fill="#0F172A" font-weight="800" font-size="${Math.round(headerH*0.33)}">BADGE</text>

  <g transform="translate(${(width - qrSize) / 2}, ${headerH + pad})">
    <rect width="${qrSize}" height="${qrSize}" rx="${Math.round(qrSize*0.06)}" fill="#FFFFFF" stroke="#E5E7EB"/>
    ${qrInner}
  </g>

  <g font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" text-anchor="middle">
    <text x="${width/2}" y="${headerH + pad + qrSize + Math.round(pad*1.4)}" fill="#111827" font-weight="900" font-size="${Math.round(width*0.06)}">${esc(name)}</text>
    <text x="${width/2}" y="${headerH + pad + qrSize + Math.round(pad*2.6)}" fill="#1E61FF" font-weight="800" font-size="${Math.round(width*0.042)}">${esc(title)}</text>
    <text x="${width/2}" y="${headerH + pad + qrSize + Math.round(pad*3.8)}" fill="#334155" font-weight="700" font-size="${Math.round(width*0.036)}">${esc(company.toUpperCase())}</text>
  </g>

  ${showEvent ? `
  <g font-family="Inter, ui-sans-serif, system-ui" text-anchor="middle" fill="#111827"
     transform="translate(0, ${headerH + pad + qrSize + Math.round(pad*4.6)})">
    <rect x="${pad}" y="0" width="${width - pad*2}" height="${eventBlockH}" rx="${Math.round(width*0.02)}" fill="#F8FAFC" stroke="#E5E7EB"/>
    <text x="${width/2}" y="${Math.round(eventBlockH*0.45)}" font-weight="700" font-size="${Math.round(width*0.038)}">${esc(eventLine1)}</text>
    <text x="${width/2}" y="${Math.round(eventBlockH*0.78)}" font-weight="600" font-size="${Math.round(width*0.032)}" fill="#475569">${esc(eventLine2)}</text>
  </g>` : ''}

  <g transform="translate(${pad}, ${height - pad - Math.round(width*0.16)})">
    <rect width="${width - pad*2}" height="${Math.round(width*0.16)}" rx="${Math.round(width*0.03)}" fill="${esc(ribbonBg)}" />
    <text x="${(width - pad*2)/2}" y="${Math.round(width*0.11)}" text-anchor="middle"
          font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
          fill="${esc(ribbonFg)}" font-weight="900" font-size="${Math.round(width*0.075)}" letter-spacing="2">${esc(label)}</text>
  </g>

  <g style="mix-blend-mode:soft-light">
    <rect x="${-Math.round(width*0.2)}" y="${-Math.round(height*0.2)}"
          width="${Math.round(width*0.5)}" height="${Math.round(height*1.6)}"
          fill="url(#sheenGrad)" transform="rotate(30, ${width/2}, ${height/2})"/>
  </g>
</svg>`;

    const png = await sharp(Buffer.from(svg), { density: dpi }).png({ compressionLevel: 9 }).toBuffer();
    const safeName = encodeURIComponent((name || 'badge').replace(/\s+/g, '-'));

    return new NextResponse(png, {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'no-store, max-age=0',
        'content-disposition': `inline; filename="badge-${safeName}.png"`,
      },
    });
  } catch (e) {
    console.error('ticket/png error:', e);
    return NextResponse.json({ error: 'Render failed' }, { status: 500 });
  }
}
