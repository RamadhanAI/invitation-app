// components/TicketActions.tsx
// components/TicketActions.tsx
'use client';

type Props = {
  pngUrl: string;
  fileBase?: string;
  printSelector?: string;
  printUrl?: string; // NEW: for reliable print via dedicated print page
};

export default function TicketActions({ pngUrl, fileBase, printSelector, printUrl }: Props) {
  async function downloadPng() {
    try {
      const res = await fetch(pngUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch PNG');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base =
        fileBase ||
        `ticket-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
      a.download = `${base}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Could not download PNG.');
    }
  }

  function printNow() {
    // Prefer the dedicated print route, which self-triggers window.print() on load
    if (printUrl) {
      const url = printUrl + (printUrl.includes('?') ? '&' : '?') + 'auto=1';
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Fallback: current page print (kept as-is)
    if (printSelector) {
      const el = document.querySelector(printSelector);
      if (!el) console.warn('printSelector not found:', printSelector);
    }
    try { window.print(); } catch {}
  }

  async function saveOffline() {
    try {
      if (!('caches' in window)) {
        alert('Offline cache not supported in this browser.');
        return;
      }
      const c = await caches.open('ticket-cache-v1');
      await c.add(new Request(location.href, { cache: 'reload' }));
      await c.add(pngUrl);
      alert('Saved for offline use.');
    } catch (e) {
      console.error(e);
      alert('Could not save offline.');
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mt-6 no-print">
      <button
        type="button"
        className="a-btn a-btn--accent"
        onClick={downloadPng}
      >
        Download PNG
      </button>
      <button type="button" className="a-btn a-btn--ghost" onClick={printNow}>
        Print
      </button>
      <button type="button" className="a-btn" onClick={saveOffline}>
        Save Offline
      </button>
    </div>
  );
}
