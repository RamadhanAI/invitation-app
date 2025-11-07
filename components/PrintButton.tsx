// components/PrintButton.tsx
// components/PrintButton.tsx
'use client';

export default function PrintButton({ href }: { href: string }) {
  return (
    <a
      className="btn a-btn--accent"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open printable badge"
    >
      Print
    </a>
  );
}
