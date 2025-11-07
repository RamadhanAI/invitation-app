// app/t/[token]/print/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const norm = (v: unknown) => {
  if (!v) return {};
  if (typeof v === 'string') { try { return JSON.parse(v); } catch {} }
  if (typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>;
  return {};
};
const s = (x: unknown, d = '') => (typeof x === 'string' ? x.trim() : d);

function appBase(req?: Request) {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (req) {
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim();
    const proto = (req.headers.get('x-forwarded-proto') || 'http').trim();
    if (host) return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

export async function GET(req: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token;

  const reg = await prisma.registration.findFirst({
    where: { qrToken: token },
    select: {
      email: true,
      meta: true,
      event: { select: { title: true, venue: true, date: true } },
    },
  });

  if (!reg) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket not found</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px">
<h1>Ticket not found</h1><p>This ticket may be invalid or revoked.</p></body></html>`;
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const m = norm(reg.meta);
  const name =
    s(m.fullName) ||
    [s(m.firstName), s(m.lastName)].filter(Boolean).join(' ') ||
    reg.email;
  const job     = s(m.jobTitle);
  const company = s(m.companyName) || s((m as any).company);
  const role    = (s((m as any).role) || 'ATTENDEE').toUpperCase();

  const eventTitle = reg.event?.title ?? 'Event';
  const when  = reg.event?.date ? new Date(reg.event.date).toLocaleString() : '';
  const venue = reg.event?.venue ?? '';
  const whenWhere = [when, venue].filter(Boolean).join(' · ');

  const base = appBase(req);

  const pngFront = `${base}/api/ticket/png?token=${encodeURIComponent(token)}&variant=front` +
    `&name=${encodeURIComponent(name)}` +
    `&title=${encodeURIComponent(job)}` +
    `&company=${encodeURIComponent(company)}` +
    `&label=${encodeURIComponent(role)}` +
    `&eventTitle=${encodeURIComponent(eventTitle)}` +
    `&eventTime=${encodeURIComponent(whenWhere)}` +
    `&width=1200&dpi=300`;

  const pngBack = `${base}/api/ticket/png?token=${encodeURIComponent(token)}&variant=back` +
    `&name=${encodeURIComponent(name)}` +
    `&label=${encodeURIComponent(role)}` +
    `&eventTitle=${encodeURIComponent(eventTitle)}` +
    `&eventTime=${encodeURIComponent(whenWhere)}` +
    `&width=1200&dpi=300`;

  const auto = /(^|[?&])auto=1($|&)/.test(req.url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${`Print Badge — ${name}`}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    background: #fff; color: #000;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .sheet { width: 100%; max-width: 180mm; margin: 0 auto; padding: 0; }
  .stack {
    display: grid;
    grid-auto-rows: max-content;
    row-gap: 8mm;
    justify-items: center;
    padding: 0;
  }
  .badge { width: 86mm; break-inside: avoid; page-break-inside: avoid; }
  .badge img { display: block; width: 86mm; height: auto; image-rendering: auto; }
  .caption { font-size: 10px; color: #333; text-align: center; margin: 2mm 0 0; }
  .fold-hint { text-align:center; font-size:10px; color:#666; margin: 2mm 0 0; }
  @media screen { body { background:#0b0d10; color:#e5e7eb; }
    .sheet { background:#11151b; border-radius:12px; padding:10mm; margin:10mm auto; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="stack">
      <div class="badge">
        <img src="${pngFront}" alt="Badge front" />
        <div class="caption">Front (86×54 mm)</div>
      </div>
      <div class="fold-hint">— fold here —</div>
      <div class="badge">
        <img src="${pngBack}" alt="Badge back" />
        <div class="caption">Back (86×54 mm)</div>
      </div>
    </div>
  </div>
  ${auto ? `<script>setTimeout(()=>{try{window.print()}catch(e){}},200)</script>` : ''}
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'no-store',
    },
  });
}
