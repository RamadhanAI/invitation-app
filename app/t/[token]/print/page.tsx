// app/t/[token]/print/page.tsx
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function displayName(meta: any) {
  const m = (typeof meta === 'string'
    ? (() => { try { return JSON.parse(meta) } catch { return {} } })()
    : (meta || {}));
  return (
    m.fullName || m.name ||
    [m.firstName, m.lastName].filter(Boolean).join(' ') ||
    [m.givenName, m.familyName].filter(Boolean).join(' ') ||
    ''
  ) || 'Guest';
}

export default async function Page({ params }: { params: { token: string } }) {
  const reg = await prisma.registration.findUnique({
    where: { qrToken: params.token },
    select: {
      email: true,
      qrToken: true,
      meta: true,
      event: { select: { title: true } },
    },
  });

  if (!reg) return <div className="p-6">Ticket not found.</div>;
  const name = displayName(reg.meta);
  const metaObj = typeof reg.meta === 'string' ? (()=>{ try{return JSON.parse(reg.meta)}catch{return {}} })() : (reg.meta || {});
  const company = metaObj.companyName || metaObj.company || '';

  return (
    <div className="flex items-center justify-center min-h-screen p-4 text-white bg-neutral-900">
      <div className="space-y-4">
        {/* Badge sheet */}
        <div className="p-0 bg-white shadow-2xl print-sheet rounded-2xl">
          {/* 86x54mm (CR80) scaled to 1000x628 viewBox */}
          <svg id="badge-svg" viewBox="0 0 1000 628" width="1000" height="628" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"  stopColor="#111827"/>
                <stop offset="100%" stopColor="#1f2937"/>
              </linearGradient>
            </defs>

            <rect x="0" y="0" width="1000" height="628" fill="url(#bg)" rx="32"/>

            <text x="40" y="100" fill="#A5B4FC" fontSize="48" fontWeight="700" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">
              {reg.event?.title ?? 'Event'}
            </text>

            <text x="40" y="250" fill="#fff" fontSize="64" fontWeight="800" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">
              {name}
            </text>

            {company ? (
              <text x="40" y="310" fill="#D1D5DB" fontSize="32" fontWeight="500" fontFamily="system-ui, -apple-system, Segoe UI, Roboto">
                {company}
              </text>
            ) : null}

            <text x="40" y="580" fill="#9CA3AF" fontSize="26" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              {reg.qrToken}
            </text>

            {/* QR image; swap to your own endpoint if desired */}
            <image
              href={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(reg.qrToken)}`}
              x="560" y="160" width="360" height="360" preserveAspectRatio="xMidYMid slice"
            />
          </svg>
        </div>

        {/* Controls UNDER the badge */}
        <div className="flex justify-center gap-2 controls">
          <a className="a-btn a-btn--ghost" href={`?svg=1`} title="Download vector SVG">Download Badge (SVG)</a>
          <a className="a-btn a-btn--accent" href={`?auto=1`} title="Open print dialog">Print Badge (PDF)</a>
        </div>
      </div>

      {/* print stylesheet + tiny inline handler for ?svg=1 / ?auto=1 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body, html { margin: 0; padding: 0; background: #fff; }
  .controls{ display:none !important; }
  .print-sheet {
    page-break-after: always;
    width: 86mm; height: 54mm;   /* CR80 card size */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function () {
  const sp = new URLSearchParams(location.search);
  const svgEl = document.getElementById('badge-svg');
  function downloadSvg(el, filename) {
    if (!el) return;
    const clone = el.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\\n' + clone.outerHTML;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename || 'badge.svg'; a.click();
    URL.revokeObjectURL(url);
  }
  if (sp.get('svg') === '1') {
    downloadSvg(svgEl, 'badge.svg');
    history.replaceState(null, '', location.pathname);
  } else if (sp.get('auto') === '1') {
    setTimeout(function () { window.print(); history.replaceState(null, '', location.pathname); }, 50);
  }
})();
          `,
        }}
      />
    </div>
  );
}
