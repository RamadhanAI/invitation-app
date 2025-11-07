// components/TicketView.tsx
// components/TicketView.tsx
'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function TicketView({ token }: { token: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  async function downloadSvg() {
    const svg = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-qr-${token.slice(0, 8)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng(scale = 4) {
    const svg = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });

    const baseSize =
      (clone.width?.baseVal?.value || (clone.getAttribute('width') ? Number(clone.getAttribute('width')) : 220)) || 220;

    const w = Math.round(baseSize * scale);
    const h = Math.round(baseSize * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `ticket-qr-${token.slice(0, 8)}.png`;
    a.click();
  }

  // Open the dedicated print route (no hydration, crisp QR)
  function openPrint() {
    const url = `/t/${encodeURIComponent(token)}/print?auto=1`;
    window.open(url, '_blank', 'noopener,noreferrer,width=900,height=700');
  }

  return (
    <div
      id="print-ticket"
      ref={cardRef}
      className="banana-card banana-sheen-hover w-[min(95vw,420px)] p-5 border border-white/10"
    >
      <div className="px-3 py-2 mb-3 text-xs font-extrabold tracking-wide badge-head rounded-xl text-slate-900">
        TICKET QR
      </div>

      <div ref={svgWrapRef} className="mx-auto my-2 qr-frame" aria-label="QR code" role="img">
        <QRCodeSVG value={token} size={220} level="H" includeMargin fgColor="#000000" bgColor="#ffffff" />
      </div>

      <div className="mt-3 text-xs break-all text-white/60">
        Token: <span className="font-mono">{token}</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 no-print">
        <button type="button" className="a-btn a-btn--accent" onClick={() => downloadPng(4)}>
          Download PNG (Hi-Res)
        </button>
        <button type="button" className="a-btn" onClick={downloadSvg}>
          Download SVG
        </button>
        <button type="button" className="a-btn a-btn--ghost" onClick={openPrint} title="Open printable badge">
          Print
        </button>
      </div>
    </div>
  );
}
