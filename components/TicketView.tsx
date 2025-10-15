'use client';

import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function TicketView({ token }: { token: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  async function downloadSvg() {
    const svg = svgWrapRef.current?.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    // Clone & ensure xmlns so it opens in editors cleanly
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-qr-${token.slice(0,8)}.svg`;
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

    const w = (svg.width.baseVal?.value || 220) * scale;
    const h = (svg.height.baseVal?.value || 220) * scale;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `ticket-qr-${token.slice(0,8)}.png`;
    a.click();
  }

  function printCard() {
    // Print only the card
    window.print();
  }

  return (
    <>
      {/* Ticket card */}
      <div
        id="print-ticket"
        ref={cardRef}
        className="banana-card banana-sheen w-[min(95vw,420px)] p-5 border border-white/10"
      >
        <div className="px-3 py-2 mb-3 text-xs font-extrabold tracking-wide badge-head rounded-xl text-slate-900">
          TICKET QR
        </div>

        <div
          ref={svgWrapRef}
          className="mx-auto my-2 qr-frame"
          aria-label="QR code"
        >
          <QRCodeSVG
            value={token}
            size={220}
            level="H"
            includeMargin
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>

        <div className="mt-3 text-xs break-all text-white/60">
          Token: <span className="font-mono">{token}</span>
        </div>

        {/* Actions under the card */}
        <div className="flex flex-wrap gap-2 mt-4 no-print">
          <button type="button" className="a-btn a-btn--accent" onClick={() => downloadPng(4)}>
            Download PNG (Hi-Res)
          </button>
          <button type="button" className="a-btn" onClick={downloadSvg}>
            Download SVG
          </button>
          <button type="button" className="a-btn a-btn--ghost" onClick={printCard}>
            Print
          </button>
        </div>
      </div>

      {/* Print CSS: only the card prints, with exact colors */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body * { visibility: hidden !important; }
  #print-ticket, #print-ticket * { visibility: visible !important; }
  #print-ticket { position: fixed; inset: 0; margin: 0 auto; box-shadow: none !important; border: none !important; }
}
          `,
        }}
      />
    </>
  );
}
