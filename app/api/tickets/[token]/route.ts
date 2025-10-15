// app/api/tickets/[token]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import QRCode from 'qrcode';
import { verifyTicket, isLikelyJwt } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeMeta(val: unknown): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, any>;
  return {};
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // Find registration by token or by decoded JWT subject
    let reg = await prisma.registration.findUnique({
      where: { qrToken: token },
      select: {
        id: true, email: true, meta: true, attended: true, scannedAt: true,
        event: { select: { title: true, venue: true, date: true } },
      },
    });

    if (!reg && isLikelyJwt(token)) {
      const p = verifyTicket(token);
      if (p?.sub) {
        reg = await prisma.registration.findUnique({
          where: { id: p.sub as string },
          select: {
            id: true, email: true, meta: true, attended: true, scannedAt: true,
            event: { select: { title: true, venue: true, date: true } },
          },
        });
      }
    }

    if (!reg) {
      const html404 = `<!doctype html><html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Ticket not found</title></head>
        <body style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#0b0d10;color:#e5e7eb;margin:0;padding:24px">
          <div style="max-width:720px;margin:0 auto">
            <div style="background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px">
              <h1 style="margin:0 0 6px 0">Ticket not found</h1>
              <p style="color:#9aa3af">This ticket may be invalid or has been revoked.</p>
            </div>
          </div>
        </body></html>`;
      return new NextResponse(html404, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    const m = normalizeMeta(reg.meta);
    const name = (m.fullName || [m.firstName, m.lastName].filter(Boolean).join(' ') || '').toString().trim();
    const job = (m.jobTitle || m.title || '').toString().trim();
    const company = (m.companyName || m.company || '').toString().trim();

    const qr = await QRCode.toDataURL(params.token, { margin: 1, scale: 8 });
    const when = reg.event?.date ? new Date(reg.event.date).toLocaleString() : '';
    const venue = reg.event?.venue || '';

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ticket</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#0b0d10; color:#e5e7eb; margin:0; padding:24px; }
    .wrap { max-width:720px; margin:0 auto; }
    .card { background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.03)); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:20px; box-shadow:0 10px 30px rgba(0,0,0,.35); }
    .head { font-weight:800; font-size:20px; margin-bottom:6px; }
    .muted { color:#9aa3af; font-size:12px; }
    .row { display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
    .qr { background:#fff; border:1px solid #e6e8ef; border-radius:14px; padding:10px; box-shadow:0 6px 18px rgba(22,24,32,.08); }
    .pill { display:inline-block; border-radius:9999px; padding:.28rem .65rem; font-size:.75rem; line-height:1rem; border:1px solid rgba(255,255,255,.14); background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.06)); }
    @media print { .no-print { display:none } body { background:#fff; color:#000 } .card { background:#fff; color:#000; border:1px solid #000; box-shadow:none } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="head">${reg.event?.title ?? 'Event ticket'}</div>
      <div class="muted">${[when, venue].filter(Boolean).join(' · ')}</div>

      <div class="row" style="margin-top:14px;">
        <div class="qr"><img src="${qr}" alt="QR" width="240" height="240" /></div>
        <div>
          <div style="font-size:18px;font-weight:900;color:#111827;background:#fff;padding:8px 12px;border-radius:12px;display:inline-block">${name || 'Guest'}</div>
          ${job ? `<div style="color:#1E61FF;margin-top:6px;font-weight:800">${job}</div>` : ''}
          ${company ? `<div style="margin-top:4px;color:#c9d1d9">${company}</div>` : ''}
          <div style="margin-top:10px"><span class="pill">${reg.email}</span></div>
          ${reg.attended ? `<div style="margin-top:10px" class="pill">Checked-in${reg.scannedAt ? ` at ${new Date(reg.scannedAt).toLocaleString()}` : ''}</div>` : ''}
          <div class="no-print" style="margin-top:12px">
            <button onclick="window.print()" style="cursor:pointer;padding:.5rem .9rem;border-radius:.75rem;border:1px solid rgba(0,0,0,.2)">Print</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e) {
    console.error('Ticket render error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
