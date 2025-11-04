// app/t/[token]/PrintActions.tsx
'use client';

export default function PrintActions() {
  const downloadSvg = () => {
    const el = document.getElementById('badge-svg') as SVGSVGElement | null;
    if (!el) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'badge.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const doPrint = () => {
    try { window.print(); } catch {}
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 text-sm controls">
      <button className="a-btn a-btn--ghost" onClick={downloadSvg}>Download Badge (SVG)</button>
      <button className="a-btn a-btn--accent" onClick={doPrint}>Print Badge</button>
    </div>
  );
}
