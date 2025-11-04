import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { QRCodeSVG } from 'qrcode.react'; // only for types, we won't render it
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeJson(val: unknown) {
  if (!val) return {};
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as any;
  return {};
}
function displayName(meta: any) {
  const m = safeJson(meta);
  return (
    m.fullName || m.name ||
    [m.firstName, m.lastName].filter(Boolean).join(' ') ||
    [m.givenName, m.familyName].filter(Boolean).join(' ') ||
    'Guest'
  );
}
function companyFromMeta(meta: any) {
  const m = safeJson(meta);
  return m.companyName || m.company || m.org || m.organisation || '';
}
function roleFromMeta(meta: any) {
  const m = safeJson(meta);
  const raw = m.role || m.badgeRole || m.ticketType || m.tier || '';
  const up = String(raw || '').trim().toUpperCase();
  if (!up) return 'ATTENDEE';
  if (/^vip/.test(up)) return 'VIP';
  if (/staff|crew|team/.test(up)) return 'STAFF';
  if (/speak/.test(up)) return 'SPEAKER';
  if (/press|media/.test(up)) return 'MEDIA';
  if (/exhib/.test(up)) return 'EXHIBITOR';
  if (/sponsor/.test(up)) return 'SPONSOR';
  return up;
}

const GOLD_MAIN  = '#D4AF37';
const GOLD_LIGHT = '#FCE7A2';
const GOLD_GLOW  = 'rgba(212,175,55,0.28)';
const VIEWBOX_W  = 1000;
const VIEWBOX_H  = 628;

// --- SVGs returned as strings so we can embed them in HTML ---
function frontSVG({ title, name, jobTitle, company, role }:{
  title:string; name:string; jobTitle:string; company:string; role:string;
}) {
  const LEFT_X = 56, LEFT_Y = 140, LEFT_W = 560;
  return `
<svg viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgLux" cx="0.5" cy="0.15" r="1">
      <stop offset="0%" stop-color="#2a2210" stop-opacity="0.6" />
      <stop offset="40%" stop-color="#0f0f0f" stop-opacity="1" />
      <stop offset="100%" stop-color="#000000" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="borderGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD_MAIN}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
    <linearGradient id="panelStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD_MAIN}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.05)" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}" rx="36"
        fill="url(#bgLux)" stroke="url(#borderGrad)" stroke-width="3" />

  <text x="${VIEWBOX_W/2}" y="84" text-anchor="middle" fill="${GOLD_LIGHT}"
        font-size="44" font-weight="700"
        font-family="system-ui, -apple-system, Segoe UI, Roboto"
        style="text-shadow:0 0 16px ${GOLD_GLOW}">${title}</text>

  <g>
    <rect x="${LEFT_X}" y="${LEFT_Y}" width="${LEFT_W}" height="420" rx="24" ry="24"
          fill="rgba(0,0,0,0.65)" stroke="url(#panelStroke)" stroke-width="2" />

    <g transform="translate(${LEFT_X + 24}, ${LEFT_Y + 24})">
      <rect x="0" y="0" width="180" height="48" rx="24" ry="24"
            fill="rgba(0,0,0,0.55)" stroke="${GOLD_MAIN}" stroke-width="1.5" />
      <text x="90" y="32" text-anchor="middle" fill="${GOLD_LIGHT}" font-size="24"
            font-weight="800" font-family="system-ui, -apple-system, Segoe UI, Roboto"
            letter-spacing="1">${role}</text>
    </g>

    <text x="${LEFT_X + 24}" y="${LEFT_Y + 120}" fill="#FFFFFF" font-size="48" font-weight="800"
          font-family="system-ui, -apple-system, Segoe UI, Roboto"
          style="paint-order:stroke fill; stroke:#000; stroke-width:1px">${name}</text>

    ${company ? `<text x="${LEFT_X + 24}" y="${LEFT_Y + 170}" fill="#9CA3AF" font-size="28" font-weight="600"
            font-family="system-ui, -apple-system, Segoe UI, Roboto">${company}</text>` : ''}

    ${jobTitle ? `<text x="${LEFT_X + 24}" y="${LEFT_Y + 210}" fill="#B4BBC7" font-size="22" font-weight="600"
            font-family="system-ui, -apple-system, Segoe UI, Roboto">${jobTitle}</text>` : ''}
  </g>
</svg>`;
}

function backSVG({ token, sponsorLogoUrl }:{ token:string; sponsorLogoUrl?:string; }) {
  const QR_SIZE = 360;
  return `
<svg viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgLux2" cx="0.5" cy="0.15" r="1">
      <stop offset="0%" stop-color="#1b1b1b" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#000000" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="borderGrad2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${GOLD_MAIN}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${VIEWBOX_W}" height="${VIEWBOX_H}" rx="36"
        fill="url(#bgLux2)" stroke="url(#borderGrad2)" stroke-width="3" />

  ${sponsorLogoUrl ? `<image href="${sponsorLogoUrl}" x="${VIEWBOX_W * 0.2}" y="40"
         width="${VIEWBOX_W * 0.6}" height="140" preserveAspectRatio="xMidYMid meet" />` : ''}

  <text x="${VIEWBOX_W/2}" y="220" text-anchor="middle" fill="${GOLD_LIGHT}" font-size="22"
        font-weight="700" font-family="system-ui, -apple-system, Segoe UI, Roboto">SCAN FOR ENTRY</text>

  <rect x="${(VIEWBOX_W - (QR_SIZE + 28)) / 2}" y="250"
        width="${QR_SIZE + 28}" height="${QR_SIZE + 28}" rx="16" ry="16"
        fill="#fff" stroke="#111" stroke-width="2" />

  <foreignObject x="${(VIEWBOX_W - QR_SIZE) / 2}" y="${250 + 14}"
                 width="${QR_SIZE}" height="${QR_SIZE}">
    <div style="display:flex;align-items:center;justify-content:center" />
  </foreignObject>

  <text x="${VIEWBOX_W/2}" y="${250 + QR_SIZE + 60}" text-anchor="middle"
        fill="#B4BBC7" font-size="18"
        font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">
    ${token}
  </text>
</svg>`;
}

export async function GET(req: Request, ctx: { params: { token: string } }) {
  const token = ctx.params.token;
  const url = new URL(req.url);
  const side = (url.searchParams.get('side') || 'front').toLowerCase();
  const auto = url.searchParams.get('auto') === '1';

  const reg = await prisma.registration.findUnique({
    where: { qrToken: token },
    select: {
      qrToken: true,
      meta: true,
      event: { select: { title: true, organizer: { select: { brand: true } } } },
    },
  });
  if (!reg) return NextResponse.json({ ok:false, error: 'Ticket not found' }, { status: 404 });

  const meta = reg.meta as any;
  const name       = displayName(meta);
  const company    = companyFromMeta(meta);
  const role       = roleFromMeta(meta);
  const jobTitle   = (safeJson(meta) as any)?.jobTitle || '';
  const eventTitle = reg.event?.title ?? 'Event';
  const brand      = safeJson(reg.event?.organizer?.brand);
  const sponsorLogoUrl =
    (brand as any)?.sponsorLogoUrl || (brand as any)?.banners?.header?.logoUrl || '';

  // Build static HTML (no React hydration)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Print Badge – ${name}</title>
<meta name="robots" content="noindex" />
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #111; }
  .sheet { width: 190mm; min-height: 120mm; margin: 0 auto; background: white; color: black; box-shadow: 0 0 0.5mm rgba(0,0,0,.1); position: relative; }
  .grid { display: grid; grid-template-columns: repeat(2, max-content); gap: 12mm 18mm; justify-content: start; padding: 10mm; }
  .card { width: 86mm; height: 54mm; position: relative; background: transparent; }
  .face { width: 86mm; height: 54mm; border-radius: 4mm; overflow: hidden; outline: 0.2mm solid rgba(0,0,0,.15); position: relative; }
  .caption { font: 10px/1.2 ui-sans-serif, system-ui; color:#333; text-align:center; margin-top: 2mm; }
  .controls { padding:12px; text-align:center; }
  .btn { display:inline-block; padding:8px 12px; margin:0 6px; border-radius:8px; background:#111; color:#fff; text-decoration:none; font-weight:700; }
  .btn:hover { filter:brightness(1.1); }

  @page { size: A4 portrait; margin: 10mm; }
  @media print {
    @page { size: 86mm 54mm; margin: 0; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { width: 86mm; height: 54mm; background: transparent !important; overflow: hidden !important; }
    .sheet { width: 86mm !important; height: 54mm !important; margin:0 !important; box-shadow:none !important; background:transparent !important; }
    .grid { display:block !important; padding:0 !important; gap:0 !important; }
    .card { width: 86mm !important; height:54mm !important; }
    .face { width: 86mm !important; height:54mm !important; }
    .caption, .controls { display:none !important; }
    .card--front { display: ${side === 'back' ? 'none' : 'block'} !important; }
    .card--back  { display: ${side === 'back' ? 'block' : 'none'} !important; }
    .sheet, .card, .face { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="controls">
    <a id="printBtn" class="btn" href="#">Print</a>
    <a class="btn" href="?side=front${auto ? '&auto=1' : ''}">Front</a>
    <a class="btn" href="?side=back${auto ? '&auto=1' : ''}">Back</a>
  </div>

  <div class="sheet">
    <div class="grid">
      <div class="card card--front">
        <div class="face">
          ${frontSVG({ title: eventTitle, name, jobTitle, company, role })}
        </div>
        <div class="caption">Front (86×54 mm)</div>
      </div>

      <div class="card card--back">
        <div class="face" style="position:relative">
          ${backSVG({ token: reg.qrToken, sponsorLogoUrl })}
          <div
            style="
              position:absolute;
              left: calc((86mm - 54mm) / 2);
              top:  calc((54mm * 250 / ${VIEWBOX_H}));
              width:54mm; height:54mm;
              display:flex; align-items:center; justify-content:center;
              pointer-events:none;">
            <!-- vector QR rendered by client-side lib (already outlined by the slot border) -->
            <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>
          </div>
        </div>
        <div class="caption">Back (86×54 mm)</div>
      </div>
    </div>
  </div>

  <script>
    (function(){
      try {
        var btn = document.getElementById('printBtn');
        if (btn) btn.addEventListener('click', function(e){ e.preventDefault(); window.print(); });
        var sp = new URLSearchParams(location.search);
        if (sp.get('auto') === '1') { setTimeout(function(){ window.print(); setTimeout(function(){ try{ window.close(); }catch(_){} }, 350); }, 120); }
      } catch(_) {}
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
  });
}
