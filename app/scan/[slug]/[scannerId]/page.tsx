// app/scan/[slug]/[scannerId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// tiny beep for success feedback (no extra deps)
function beep(duration = 120, freq = 880) {
  try {
    const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = actx.createOscillator(); const g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = .08;
    o.start(); setTimeout(() => { o.stop(); actx.close(); }, duration);
  } catch {}
}

export default function ScanPage({ params }: { params: { slug: string; scannerId: string } }) {
  const { slug, scannerId } = params;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle'|'starting'|'scanning'|'blocked'|'done'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [last, setLast] = useState<string>('');
  const [key, setKey] = useState<string>(() =>
    (typeof window !== 'undefined' ? localStorage.getItem('scanner-key') || '' : '')
  );

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('scanner-key', key);
  }, [key]);

  async function start() {
    if (!key) { setMsg('Enter Scanner Key first.'); return; }
    setStatus('starting');
    setMsg('Starting camera…');

    try {
      const codeReader = new BrowserMultiFormatReader();
      const video = videoRef.current!;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      setStatus('scanning');
      setMsg('Point camera at QR…');

      codeReader.decodeFromVideoDevice(undefined, video, async (result, err) => {
        if (result?.getText) {
          const token = result.getText();
          if (token && token !== last) {
            setLast(token);
            setStatus('starting');
            setMsg('Checking in…');
            try {
              const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': key },
                body: JSON.stringify({ token, scannerId, station: scannerId })
              });
              const json = await res.json().catch(() => null);
              if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Check-in failed');
              beep();
              setStatus('done');
              setMsg(`Checked-in: ${json.registration.email} (${scannerId})`);
              setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1200);
            } catch (e: any) {
              setStatus('error');
              setMsg(e?.message ?? 'Error');
              setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1500);
            }
          }
        }
        if (err?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      });
      return () => { stream.getTracks().forEach(t => t.stop()); };
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      else { setStatus('error'); setMsg('Unable to start camera'); }
    }
  }

  return (
    <div className={`max-w-4xl px-4 py-6 mx-auto ${status==='done' ? 'animate-pulse' : ''}`}>
      <h1 className="text-xl font-semibold">Scanner • {scannerId}</h1>
      <div className="flex items-center gap-2 mt-3">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Scanner Key"
          className="px-3 py-2 border rounded-md w-80"
        />
        <button onClick={start} className="px-3 py-2 text-white bg-blue-600 rounded-md">Start</button>
        <a className="text-sm underline" href={`/e/${encodeURIComponent(slug)}`} target="_blank">Open event page</a>
      </div>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <video ref={videoRef} className="w-full bg-black border rounded-lg aspect-video" muted playsInline />
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Status</div>
          <div className="mt-1 font-mono">{status}</div>
          <div className="mt-2 text-sm">{msg}</div>
          {status === 'blocked' && (
            <div className="mt-3 text-xs opacity-80">
              Camera is blocked. Click the padlock → Site settings → Camera → Allow, then press Start again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
