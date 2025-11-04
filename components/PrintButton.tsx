// components/PrintButton.tsx
'use client';

export default function PrintButton({ auto }: { auto?: boolean }) {
  function handlePrint() {
    // if the route was opened with ?auto=1 it already printed on load
    if (!auto) {
      try { window.print(); } catch {}
    }
  }

  return (
    <button
      type="button"
      className="btn"
      onClick={handlePrint}
      // small safety for browsers that block programmatic print
      aria-label="Print badge"
    >
      Print
    </button>
  );
}
