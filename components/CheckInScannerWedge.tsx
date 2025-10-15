// components/CheckInScannerWedge.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

type Props = { slug: string; scannerId: string; scannerKey: string };

export default function CheckInScannerWedge({ slug, scannerId, scannerKey }: Props) {
  const [token, setToken] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submitToken(t: string) {
    if (!t || !slug || !scannerKey) return;
    try {
      const res = await fetch('/api/scanner/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: t.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Check-in failed');
      setLog((l) => [`✅ ${json.registration?.email ?? t}`, ...l].slice(0, 8));
    } catch (e: any) {
      setLog((l) => [`❌ ${e?.message || 'Error'} (${t})`, ...l].slice(0, 8));
    }
  }

  return (
    <div className="grid gap-3">
      <input
        ref={inputRef}
        className="font-mono text-lg a-input"
        placeholder="Focus here and scan the QR (or paste token)…"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            submitToken(token);
            setToken('');
          }
        }}
      />
      <div className="text-xs opacity-70">
        Most scanner guns send an Enter key automatically — this box will auto-submit.
      </div>
      <div className="mt-2 text-sm">
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
