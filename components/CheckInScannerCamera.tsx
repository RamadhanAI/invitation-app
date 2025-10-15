// components/CheckInScannerCamera.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

type Props = { slug: string; scannerId: string; scannerKey: string }; // slug/key only used to gate UI before start

export default function CheckInScannerCamera({ slug, scannerId, scannerKey }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<'idle'|'starting'|'scanning'|'blocked'|'done'|'error'>('idle');
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState('');

  async function submitToken(token: string) {
    setStatus('starting'); setMsg('Checking in…');
    const res = await fetch('/api/scanner/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.error || 'Check-in failed');
    setStatus('done'); setMsg(`Checked-in: ${j.registration?.email ?? token}`);
    setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1000);
  }

  async function start() {
    if (!slug) { setMsg('Enter event slug first.'); return; }
    if (!scannerKey) { setMsg('Enter Scanner Key first.'); return; }

    setStatus('starting'); setMsg('Starting camera…');
    try {
      const codeReader = new BrowserMultiFormatReader();
      const video = videoRef.current!;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      setStatus('scanning'); setMsg('Point camera at QR…');

      const controls = await codeReader.decodeFromVideoDevice(undefined, video, async (result, err) => {
        if (result?.getText) {
          const token = result.getText();
          if (token && token !== last) {
            setLast(token);
            try {
              await submitToken(token);
            } catch (e: any) {
              setStatus('error'); setMsg(e?.message ?? 'Error');
              setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1200);
            }
          }
        }
        if (err?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      });

      controlsRef.current = controls;
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      else { setStatus('error'); setMsg('Unable to start camera'); }
    }
  }

  function stop() {
    try { controlsRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    controlsRef.current = null;
    streamRef.current = null;
    setStatus('idle'); setMsg('');
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        {status !== 'scanning'
          ? <button onClick={start} className="a-btn a-btn--primary">Start Camera</button>
          : <button onClick={stop} className="a-btn a-btn--ghost">Stop</button>}
        <div className="self-center text-sm opacity-75">{msg}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <video ref={videoRef} className="w-full bg-black border rounded-lg aspect-video" muted playsInline />
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Status</div>
          <div className="mt-1 font-mono">{status}</div>
          {status === 'blocked' && (
            <div className="mt-3 text-xs opacity-80">
              Camera blocked. Allow camera and press Start again.
            </div>
          )}
          <div className="mt-2 text-xs opacity-70">Scanner: {scannerId}</div>
        </div>
      </div>
    </div>
  );
}
