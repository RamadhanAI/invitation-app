// components/CheckInScannerCamera.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

type Props = { stationName?: string };

export default function CheckInScannerCamera({ stationName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'blocked' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [lastToken, setLastToken] = useState('');

  function hardStop() {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    if (videoRef.current) (videoRef.current as any).srcObject = null;
  }

  async function submitToken(token: string) {
    setStatus('starting'); setMsg('Checking in…');
    const res = await fetch('/api/scanner/checkin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) throw new Error(j?.error || 'Check-in failed');
    setStatus('done'); setMsg(`Checked-in: ${j.registration?.email ?? token}`);
    setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1000);
  }

  async function startCamera() {
    if (status === 'scanning' && streamRef.current && controlsRef.current) return;
    hardStop(); setStatus('starting'); setMsg('Starting camera…');
    try {
      const videoEl = videoRef.current!; let stream: MediaStream | null = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
      catch { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      streamRef.current = stream; videoEl.srcObject = stream; videoEl.setAttribute('playsinline', 'true'); videoEl.muted = true; await videoEl.play();
      setStatus('scanning'); setMsg('Point camera at QR…');

      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoEl, async (result, err) => {
        if (err?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); return; }
        const text = result?.getText?.(); if (!text) return;
        if (text === lastToken) return;
        setLastToken(text);
        try { await submitToken(text.trim()); }
        catch (e: any) { setStatus('error'); setMsg(e?.message ?? 'Error'); setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1200); }
      });
      controlsRef.current = controls;
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      else { setStatus('error'); setMsg('Unable to start camera'); }
    }
  }

  function stopCamera() { hardStop(); setStatus('idle'); setMsg(''); }
  useEffect(() => () => { hardStop(); }, []);

  return (
    <div className="grid gap-4 text-white">
      <div className="flex flex-wrap items-center gap-2">
        {status !== 'scanning' ? (
          <button onClick={startCamera} className="a-btn a-btn--primary">Start Camera</button>
        ) : (
          <button onClick={stopCamera} className="a-btn a-btn--ghost">Stop</button>
        )}
        {stationName && <div className="text-xs opacity-70">Station: <span className="font-semibold whitespace-nowrap">{stationName}</span></div>}
        <div className="self-center text-sm opacity-75">{msg}</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <video ref={videoRef} className="w-full bg-black border rounded-lg aspect-video" muted playsInline />
        <div className="p-4 border rounded-lg border-white/10 bg-white/5">
          <div className="text-sm opacity-70">Status</div>
          <div className="mt-1 font-mono">{status}</div>
          {status === 'blocked' && <div className="mt-3 text-xs opacity-80">Camera blocked. Allow camera and press Start again.</div>}
          {stationName && <div className="mt-2 text-xs opacity-70">Scanner: {stationName}</div>}
        </div>
      </div>
    </div>
  );
}
