// components/CheckInScannerCamera.tsx
// components/CheckInScannerCamera.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

type Props = {
  stationName?: string; // purely for UI label ("Gate 1 — Ahmed")
};

export default function CheckInScannerCamera({ stationName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // ZXing + media control handles
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // simple UI state machine
  const [status, setStatus] = useState<
    'idle' | 'starting' | 'scanning' | 'blocked' | 'done' | 'error'
  >('idle');
  const [msg, setMsg] = useState('');
  const [lastToken, setLastToken] = useState('');

  // ---- util: safely stop camera + decoder ----
  function hardStop() {
    // stop ZXing decode loop
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;

    // stop camera tracks
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;

    // reset video element
    if (videoRef.current) {
      (videoRef.current as any).srcObject = null;
    }
  }

  // ---- submit scan result to server ----
  async function submitToken(token: string) {
    setStatus('starting');
    setMsg('Checking in…');

    const res = await fetch('/api/scanner/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // same-origin by default, so your httpOnly scan_sess cookie goes with it
      body: JSON.stringify({ token }),
    });

    const j = await res.json().catch(() => null);

    if (!res.ok || !j?.ok) {
      throw new Error(j?.error || 'Check-in failed');
    }

    setStatus('done');
    setMsg(`Checked-in: ${j.registration?.email ?? token}`);

    // after showing success briefly, go back to scanning
    setTimeout(() => {
      setStatus('scanning');
      setMsg('Point camera at QR…');
    }, 1000);
  }

  // ---- start camera & decoding (only if not already active) ----
  async function startCamera() {
    // guard: if we're already scanning, don't spin up ANOTHER stream/decoder
    if (status === 'scanning' && streamRef.current && controlsRef.current) {
      return;
    }

    // just in case we were half-started / errored, clean any leftovers first
    hardStop();

    setStatus('starting');
    setMsg('Starting camera…');

    try {
      // ask for camera
      const videoEl = videoRef.current!;
      let stream: MediaStream | null = null;

      // prefer environment / back camera, fallback to any camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      // bind to <video>
      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true'); // iOS: don't fullscreen
      videoEl.muted = true; // iOS autoplay policy
      await videoEl.play();

      // move to "scanning" mode BEFORE we start ZXing decodeFromVideoDevice,
      // so UI reflects reality and we don't let user mash Start repeatedly.
      setStatus('scanning');
      setMsg('Point camera at QR…');

      // spin up ZXing loop
      const reader = new BrowserMultiFormatReader();

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoEl,
        async (result, err) => {
          // if user revoked camera mid-stream, surface that once
          if (err?.name === 'NotAllowedError') {
            setStatus('blocked');
            setMsg('Camera permission denied');
            return;
          }

          const text = result?.getText?.();
          if (!text) return;

          // throttle duplicate spam
          if (text === lastToken) return;

          setLastToken(text);

          try {
            await submitToken(text.trim());
          } catch (e: any) {
            setStatus('error');
            setMsg(e?.message ?? 'Error');

            // after showing error, resume scanning
            setTimeout(() => {
              setStatus('scanning');
              setMsg('Point camera at QR…');
            }, 1200);
          }
        }
      );

      // keep so we can stop cleanly later
      controlsRef.current = controls;
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        setStatus('blocked');
        setMsg('Camera permission denied');
      } else {
        setStatus('error');
        setMsg('Unable to start camera');
      }
    }
  }

  // ---- user pressed Stop or component unmounted ----
  function stopCamera() {
    hardStop();
    setStatus('idle');
    setMsg('');
    // keep lastToken so we don't insta-repeat the same QR on next start
  }

  // auto-clean on unmount
  useEffect(() => {
    return () => {
      hardStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-4 text-white">
      <div className="flex flex-wrap items-center gap-2">
        {status !== 'scanning' ? (
          <button onClick={startCamera} className="a-btn a-btn--primary">
            Start Camera
          </button>
        ) : (
          <button onClick={stopCamera} className="a-btn a-btn--ghost">
            Stop
          </button>
        )}

        {stationName && (
          <div className="text-xs opacity-70">
            Station:{' '}
            <span className="font-semibold whitespace-nowrap">
              {stationName}
            </span>
          </div>
        )}

        <div className="self-center text-sm opacity-75">{msg}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <video
          ref={videoRef}
          className="w-full bg-black border rounded-lg aspect-video"
          muted
          playsInline
        />

        <div className="p-4 border rounded-lg border-white/10 bg-white/5">
          <div className="text-sm opacity-70">Status</div>
          <div className="mt-1 font-mono">{status}</div>

          {status === 'blocked' && (
            <div className="mt-3 text-xs opacity-80">
              Camera blocked. Allow camera and press Start again.
            </div>
          )}

          {stationName && (
            <div className="mt-2 text-xs opacity-70">
              Scanner: {stationName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
