// app/scan/page.tsx
// app/scan/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CheckInScannerWedge = dynamic(() => import('@/components/CheckInScannerWedge'), { ssr: false });
const CheckInScannerCamera = dynamic(() => import('@/components/CheckInScannerCamera'), { ssr: false });

export default function ScanPage() {
  const [slug, setSlug] = useState(() => localStorage.getItem('scan:slug') || '');
  const [scannerId, setScannerId] = useState(() => localStorage.getItem('scan:id') || '');
  const [scannerKey, setScannerKey] = useState(() => localStorage.getItem('scanner-key') || '');
  const [mode, setMode] = useState<'keyboard' | 'camera'>(() => (localStorage.getItem('scan:mode') as any) || 'keyboard');

  useEffect(() => { localStorage.setItem('scan:slug', slug); }, [slug]);
  useEffect(() => { localStorage.setItem('scan:id', scannerId); }, [scannerId]);
  useEffect(() => { localStorage.setItem('scanner-key', scannerKey); }, [scannerKey]);
  useEffect(() => { localStorage.setItem('scan:mode', mode); }, [mode]);

  const ready = !!slug && !!scannerKey;

  return (
    <div className="max-w-4xl px-4 py-6 mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Scanner</h1>

      {/* Settings */}
      <div className="p-3 space-y-2 border rounded-lg a-card">
        <div className="grid items-center grid-cols-1 gap-2 md:grid-cols-3">
          <input className="a-input" placeholder="Event slug" value={slug} onChange={(e)=>setSlug(e.target.value)} />
          <input className="a-input" placeholder="Scanner name" value={scannerId} onChange={(e)=>setScannerId(e.target.value)} />
          <input className="a-input" placeholder="Scanner key / secret" value={scannerKey} onChange={(e)=>setScannerKey(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 pt-1">
          <label className="text-sm"><input type="radio" checked={mode==='keyboard'} onChange={()=>setMode('keyboard')} /> Keyboard gun</label>
          <label className="text-sm"><input type="radio" checked={mode==='camera'} onChange={()=>setMode('camera')} /> Camera</label>
          {!ready && <span className="text-xs text-amber-400">Enter slug & key to start</span>}
        </div>
      </div>

      {/* Exactly one scanner UI at a time */}
      {mode === 'keyboard' && (
        <CheckInScannerWedge slug={slug} scannerId={scannerId || 'unknown'} scannerKey={scannerKey} />
      )}

      {mode === 'camera' && ready && (
        <CheckInScannerCamera slug={slug} scannerId={scannerId || 'unknown'} scannerKey={scannerKey} />
      )}
    </div>
  );
}
