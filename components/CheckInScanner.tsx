// components/CheckInScanner.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

type Props = {
  /** Optional: if provided, we'll call it with the token.
   *  If omitted, this component will POST /api/scanner/checkin itself. */
  onToken?: (t: string) => void;
};

export default function CheckInScanner({ onToken }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle'|'starting'|'scanning'|'blocked'|'done'|'error'>('idle');
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState('');

  useEffect(() => {
    return () => {
      const v = videoRef.current as any;
      const s: MediaStream | null = v?.srcObject || null;
      s?.getTracks()?.forEach((t) => t.stop());
    };
  }, []);

  async function submit(token: string) {
    if (onToken) return onToken(token);
    const res = await fetch('/api/scanner/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.error || 'Check-in failed');
  }

  async function start() {
    setStatus('starting'); setMsg('Starting camera…');
    try {
      const codeReader = new BrowserMultiFormatReader();
      const video = videoRef.current!;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream;
      await video.play();
      setStatus('scanning'); setMsg('Point camera at QR…');

      const controlsPromise = codeReader.decodeFromVideoDevice(undefined, video, async (result, err) => {
        if (result?.getText) {
          const token = result.getText();
          if (token && token !== last) {
            setLast(token);
            setStatus('starting'); setMsg('Checking in…');
            try {
              await submit(token);
              setStatus('done'); setMsg('Checked-in ✓');
              setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 800);
            } catch (e: any) {
              setStatus('error'); setMsg(e?.message ?? 'Error');
              setTimeout(() => { setStatus('scanning'); setMsg('Point camera at QR…'); }, 1100);
            }
          }
        }
        if (err?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      });

      return () => { controlsPromise.then((c) => c?.stop?.()).catch(() => {}); stream.getTracks().forEach((t) => t.stop()); };
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') { setStatus('blocked'); setMsg('Camera permission denied'); }
      else { setStatus('error'); setMsg('Unable to start camera'); }
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <button onClick={start} className="a-btn a-btn--primary">Start Camera</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <video ref={videoRef} className="w-full bg-black border rounded-lg aspect-video" muted playsInline />
        <div className="p-4 border rounded-lg">
          <div className="text-sm opacity-70">Status</div>
          <div className="mt-1 font-mono">{status}</div>
          <div className="mt-2 text-sm">{msg}</div>
          {status === 'blocked' && <div className="mt-3 text-xs opacity-80">Allow camera access and press Start again.</div>}
        </div>
      </div>
    </div>
  );
}
