// components/TicketActions.tsx
'use client';

type Props = {
  /** Direct PNG URL to download (same-origin API route is perfect) */
  pngUrl: string;
  /** Optional file name stem for downloads (default derived from time) */
  fileBase?: string;
  /** Optional selector for the element you want to print only (e.g. '#print-ticket') */
  printSelector?: string;
};

export default function TicketActions({ pngUrl, fileBase, printSelector }: Props) {
  async function downloadPng() {
    try {
      // Fetch as blob, then force a file download (no new tab).
      const res = await fetch(pngUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch PNG');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const base = fileBase || `ticket-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}`;
      a.download = `${base}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Could not download PNG.');
    }
  }

  function printNow() {
    // If a specific section should print, you can add a print-only CSS rule
    // in globals that shows just that selector (you already have .ticket / .no-print).
    // Here we simply trigger print; CSS controls the scope.
    if (printSelector) {
      // Optional: flash a class if you want target-only print tweaks
      const el = document.querySelector(printSelector);
      if (!el) console.warn('printSelector not found:', printSelector);
    }
    window.print();
  }

  async function saveOffline() {
    try {
      if (!('caches' in window)) {
        alert('Offline cache not supported in this browser.');
        return;
      }
      // Best-effort stash; a proper Service Worker is recommended for real offline UX.
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
      <button type="button" className="a-btn a-btn--accent" onClick={downloadPng}>
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
