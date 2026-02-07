// components/CheckInScannerWedge.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

    // quick, distinctive tones
    const freq = kind === 'ok' ? 880 : kind === 'warn' ? 520 : kind === 'queued' ? 660 : 220;
    o.frequency.value = freq;
    o.type = 'sine';
    g.gain.value = 0.08;

    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => {});
    }, kind === 'bad' ? 170 : 120);
  } catch {
    // ignore
  }

  try {
    if (navigator.vibrate) {
      const pattern = kind === 'ok' ? [40] : kind === 'warn' ? [30, 40, 30] : kind === 'queued' ? [20, 20, 40] : [160];
      navigator.vibrate(pattern);
    }
  } catch {}
}

export default function CheckInScannerWedge({ slug, stationName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [light, setLight] = useState<Light>('idle');
  const [headline, setHeadline] = useState('Ready');
  const [sub, setSub] = useState('Focus here and scan…');
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [log, setLog] = useState<string[]>([]);
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
      setSub(online ? 'Focus here and scan…' : 'Offline mode — scans will queue');
    }, ms);
  }

  function pushLog(line: string) {
    setLog((l) => [line, ...l].slice(0, 12));
  }

  async function offlineValidateAndQueue(token: string) {
    // get cached allowlist
    let cached = await getCachedTokenSet(slug);
    if (!cached) cached = await refreshOfflineTokenSet(slug);

    const h = await sha256B64url(token);
    const ok = !!cached?.hashes?.includes?.(h);

    if (!ok) {
      setLight('bad');
      setHeadline('DENIED');
      setSub(`Not in allowlist · ${last4(token)}`);
      beep('bad');
      pushLog(`🟥 DENIED (offline) …${last4(token)}`);
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
    pushLog(`🟦 QUEUED (offline) …${last4(token)} · queue=${qn}`);
    clearSoon(1100);
  }

  async function submitToken(token: string) {
    const t = token.trim();
    if (!t) return;

    // optimistic UI
    setLight('idle');
    setHeadline('Checking…');
    setSub(online ? 'Door-speed verify' : 'Offline verify');
    setQueueCount(getQueueSize(slug));

    // If offline, do offline path immediately
    if (!online) {
      await offlineValidateAndQueue(t);
      return;
    }

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
        pushLog(`🟨 ALREADY IN · ${nm} · …${last4(t)}`);
        clearSoon(1200);
        return;
      }

      if (state === 'REIN') {
        setLight('warn');
        setHeadline('RE-ENTRY');
        setSub(`${nm} · ${role} · …${last4(t)}`);
        beep('warn');
        pushLog(`🟨 RE-ENTRY · ${nm} · …${last4(t)}`);
        clearSoon(1200);
        return;
      }

      setLight('ok');
      setHeadline('WELCOME');
      setSub(`${nm} · ${role} · …${last4(t)}`);
      beep('ok');
      pushLog(`✅ IN · ${nm} · ${role} · …${last4(t)}`);
      clearSoon(1100);
    } catch (e: any) {
      // if online request fails (wifi died mid-scan), fall back to offline
      const msg = String(e?.message || 'Network error');
      pushLog(`⚠️ net fail → offline (${msg}) …${last4(t)}`);
      await offlineValidateAndQueue(t);
    }
  }

  async function syncQueue() {
    if (!navigator.onLine) return;
    const done = await flushQueue(slug);
    if (done > 0) pushLog(`🔁 synced ${done} queued scans`);
    setQueueCount(getQueueSize(slug));
  }

  useEffect(() => {
    inputRef.current?.focus();

    const onOnline = () => {
      setOnline(true);
      setSub('Focus here and scan…');
      void syncQueue();
    };
    const onOffline = () => {
      setOnline(false);
      setSub('Offline mode — scans will queue');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // initial
    setOnline(navigator.onLine);
    setQueueCount(getQueueSize(slug));
    if (navigator.onLine) void syncQueue();

    const id = window.setInterval(() => {
      setQueueCount(getQueueSize(slug));
      if (navigator.onLine) void syncQueue();
    }, 5000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(id);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, [slug]);

  return (
    <div className="grid gap-4 text-white">
      {/* Traffic light */}
      <div className={`rounded-2xl border p-4 md:p-5 ${bgClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-widest opacity-70">
              {online ? 'Online' : 'Offline'} · {stationName || 'Station'}
              {queueCount > 0 ? ` · Queue ${queueCount}` : ''}
            </div>
            <div className="mt-1 text-2xl font-semibold">{headline}</div>
            <div className="mt-1 text-sm opacity-80">{sub}</div>
          </div>

          <button
            type="button"
            className="text-xs a-btn a-btn--ghost"
            onClick={() => {
              void syncQueue();
              inputRef.current?.focus();
            }}
            title="Sync queued scans (when online)"
          >
            Sync
          </button>
        </div>
      </div>

      {/* Wedge input */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          className="font-mono text-lg a-input input !bg-white/95 !text-black placeholder:!text-black/40"
          placeholder={online ? 'Focus here and scan the QR…' : 'Offline: scan will queue…'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = (e.currentTarget.value || '').trim();
              e.currentTarget.value = '';
              void submitToken(v);
            }
          }}
        />
        <div className="text-xs opacity-70 whitespace-nowrap">
          {stationName ? <>Station: <span className="font-semibold">{stationName}</span></> : null}
        </div>
      </div>

      <div className="text-[11px] opacity-65">
        Most QR guns auto-send Enter. This input auto-submits. (Your door staff will love you for this.)
      </div>

      {/* log */}
      <div className="p-3 border rounded-2xl border-white/10 bg-white/5">
        <div className="mb-2 text-xs font-medium opacity-70">Recent</div>
        <div className="font-mono text-[12px] leading-relaxed">
          {log.length ? log.map((l, i) => <div key={i}>{l}</div>) : <div className="opacity-60">No scans yet.</div>}
        </div>
      </div>
    </div>
  );
}
