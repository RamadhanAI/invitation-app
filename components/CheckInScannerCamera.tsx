// components/CheckInScannerCamera.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { enqueueScan, flushQueue, getQueueSize } from '@/lib/scanQueue';
import { getCachedTokenSet, refreshOfflineTokenSet, sha256B64url } from '@/lib/offlineTokens';

type Props = {
  slug: string;
  stationName?: string;
};

type Light = 'idle' | 'ok' | 'warn' | 'bad' | 'queued';

function safeJson(val: any) {
  if (!val) return {};
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  return {};
}

function displayName(meta: any, email?: string) {
  const m = safeJson(meta);
  const name =
    (m.fullName || m.name || [m.firstName, m.lastName].filter(Boolean).join(' '))?.toString?.().trim?.() || '';
  return name || email || 'Guest';
}

function displayRole(meta: any) {
  const m = safeJson(meta);
  const raw = (m.role || m.badgeRole || m.ticketType || m.tier || '').toString().trim();
  const up = raw.toUpperCase();
  if (!up) return 'ATTENDEE';
  if (/^VIP/.test(up)) return 'VIP';
  if (/STAFF|CREW|TEAM/.test(up)) return 'STAFF';
  if (/SPEAK/.test(up)) return 'SPEAKER';
  if (/PRESS|MEDIA/.test(up)) return 'MEDIA';
  return up;
}

function last4(t: string) {
  const s = (t || '').trim();
  return s.length <= 4 ? s : s.slice(-4);
}

function beep(kind: 'ok' | 'warn' | 'bad' | 'queued') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);

    const freq = kind === 'ok' ? 880 : kind === 'warn' ? 520 : kind === 'queued' ? 660 : 220;
    o.frequency.value = freq;
    o.type = 'sine';
    g.gain.value = 0.08;

    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, kind === 'bad' ? 170 : 120);
  } catch {}

  try {
    if (navigator.vibrate) {
      const pattern = kind === 'ok' ? [40] : kind === 'warn' ? [30, 40, 30] : kind === 'queued' ? [20, 20, 40] : [160];
      navigator.vibrate(pattern);
    }
  } catch {}
}

export default function CheckInScannerCamera({ slug, stationName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const lastTokenRef = useRef<string>('');
  const lastAtRef = useRef<number>(0);

  const [light, setLight] = useState<Light>('idle');
  const [headline, setHeadline] = useState('Ready');
  const [sub, setSub] = useState('Point camera at QR…');
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const clearTimer = useRef<number | null>(null);

  const bgClass = useMemo(() => {
    if (light === 'ok') return 'bg-emerald-500/15 border-emerald-400/30';
    if (light === 'warn') return 'bg-amber-500/15 border-amber-400/30';
    if (light === 'queued') return 'bg-sky-500/15 border-sky-400/30';
    if (light === 'bad') return 'bg-rose-500/15 border-rose-400/30';
    return 'bg-white/5 border-white/10';
  }, [light]);

  function clearSoon(ms = 1200) {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      setLight('idle');
      setHeadline('Ready');
      setSub(online ? 'Point camera at QR…' : 'Offline mode — scans will queue');
    }, ms);
  }

  function hardStop() {
    try { controlsRef.current?.stop(); } catch {}
    controlsRef.current = null;
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    if (videoRef.current) (videoRef.current as any).srcObject = null;
  }

  async function offlineValidateAndQueue(token: string) {
    let cached = await getCachedTokenSet(slug);
    if (!cached) cached = await refreshOfflineTokenSet(slug);

    const h = await sha256B64url(token);
    const ok = !!cached?.hashes?.includes?.(h);

    if (!ok) {
      setLight('bad');
      setHeadline('DENIED');
      setSub(`Not in allowlist · …${last4(token)}`);
      beep('bad');
      clearSoon(1400);
      return;
    }

    enqueueScan(slug, token, 'IN');
    const qn = getQueueSize(slug);
    setQueueCount(qn);

    setLight('queued');
    setHeadline('QUEUED');
    setSub(`Offline saved · will sync · …${last4(token)}`);
    beep('queued');
    clearSoon(1100);
  }

  async function submitToken(token: string) {
    const t = token.trim();
    if (!t) return;

    setQueueCount(getQueueSize(slug));

    if (!online) {
      await offlineValidateAndQueue(t);
      return;
    }

    setLight('idle');
    setHeadline('Checking…');
    setSub('Door-speed verify');

    try {
      const res = await fetch('/api/scanner/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: t, action: 'IN' }),
      });

      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Check-in failed');

      const reg = j?.registration;
      const state = String(j?.state || '').toUpperCase();

      const nm = displayName(reg?.meta, reg?.email);
      const role = displayRole(reg?.meta);

      if (state === 'ALREADY_IN' || state === 'DUPLICATE') {
        setLight('warn');
        setHeadline('ALREADY IN');
        setSub(`${nm} · ${role} · …${last4(t)}`);
        beep('warn');
        clearSoon(1200);
        return;
      }

      if (state === 'REIN') {
        setLight('warn');
        setHeadline('RE-ENTRY');
        setSub(`${nm} · ${role} · …${last4(t)}`);
        beep('warn');
        clearSoon(1200);
        return;
      }

      setLight('ok');
      setHeadline('WELCOME');
      setSub(`${nm} · ${role} · …${last4(t)}`);
      beep('ok');
      clearSoon(1100);
    } catch {
      await offlineValidateAndQueue(t);
    }
  }

  async function syncQueue() {
    if (!navigator.onLine) return;
    await flushQueue(slug);
    setQueueCount(getQueueSize(slug));
  }

  async function startCamera() {
    hardStop();

    try {
      const videoEl = videoRef.current!;
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = stream;
      videoEl.srcObject = stream;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.muted = true;
      await videoEl.play();

      setSub(online ? 'Point camera at QR…' : 'Offline mode — scans will queue');

      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoEl, async (result, err) => {
        if (err?.name === 'NotAllowedError') {
          setLight('bad');
          setHeadline('CAMERA BLOCKED');
          setSub('Allow camera permission and retry');
          return;
        }

        const text = result?.getText?.();
        if (!text) return;

        const token = text.trim();
        const now = Date.now();

        // ignore repeats within 1200ms
        if (token === lastTokenRef.current && now - lastAtRef.current < 1200) return;
        lastTokenRef.current = token;
        lastAtRef.current = now;

        void submitToken(token);
      });

      controlsRef.current = controls;
    } catch (e: any) {
      setLight('bad');
      setHeadline('CAMERA ERROR');
      setSub(e?.name === 'NotAllowedError' ? 'Permission denied' : 'Unable to start camera');
    }
  }

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      setSub('Point camera at QR…');
      void syncQueue();
    };
    const onOffline = () => {
      setOnline(false);
      setSub('Offline mode — scans will queue');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    setOnline(navigator.onLine);
    setQueueCount(getQueueSize(slug));
    if (navigator.onLine) void syncQueue();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      hardStop();
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, [slug]);

  return (
    <div className="grid gap-4 text-white">
      {/* Traffic light */}
      <div className={`rounded-2xl border p-4 md:p-5 ${bgClass}`}>
        <div className="text-[11px] uppercase tracking-widest opacity-70">
          {online ? 'Online' : 'Offline'} · {stationName || 'Station'}{queueCount > 0 ? ` · Queue ${queueCount}` : ''}
        </div>
        <div className="mt-1 text-2xl font-semibold">{headline}</div>
        <div className="mt-1 text-sm opacity-80">{sub}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={startCamera} className="a-btn a-btn--primary">Start Camera</button>
        <button onClick={() => { hardStop(); setSub('Point camera at QR…'); }} className="a-btn a-btn--ghost">Stop</button>
        <button onClick={() => void syncQueue()} className="text-xs a-btn a-btn--ghost">Sync</button>
      </div>

      <video ref={videoRef} className="w-full bg-black border rounded-2xl border-white/10 aspect-video" muted playsInline />
    </div>
  );
}
