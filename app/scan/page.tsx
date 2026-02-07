// app/scan/page.tsx
// app/scan/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import CheckInScannerCamera from '@/components/CheckInScannerCamera';
import CheckInScannerWedge from '@/components/CheckInScannerWedge';
import { getQueueSize } from '@/lib/scanQueue';
import { refreshOfflineTokenSet } from '@/lib/offlineTokens';

const API = {
  arm: '/api/scanner/session',
  status: '/api/scanner/session',
  disarm: '/api/scanner/session',
} as const;

export default function ScanPage() {
  const [eventSlug, setEventSlug] = useState('prime-expo-2025');
  const [stationCode, setStationCode] = useState('S1');
  const [stationSecret, setStationSecret] = useState('');

  const [armed, setArmed] = useState(false);
  const [stationName, setStationName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [mode, setMode] = useState<'wedge' | 'camera'>('wedge');
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queueCount, setQueueCount] = useState(0);

  const slugRef = useRef<HTMLInputElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);

  const inputClass = 'input input--light';

  const jsonOrNull = async (r: Response) => {
    try {
      return await r.json();
    } catch {
      return null;
    }
  };

  const tryStatus = async () => {
    const r = await fetch(API.status, { method: 'GET', cache: 'no-store' });
    const j = await jsonOrNull(r);
    if (!r.ok) return { armed: false as const, label: '', slug: '' };
    return { armed: Boolean(j?.ok), label: j?.station?.name || '', slug: j?.event?.slug || '' };
  };

  const arm = async () => {
    const body = {
      eventSlug: eventSlug.trim(),
      code: stationCode.trim(),
      secret: stationSecret.trim(),
    };

    let r: Response;
    try {
      r = await fetch(API.arm, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      return { ok: false as const, err: 'Network issue — can’t reach the check-in service.' };
    }

    const j = await jsonOrNull(r);
    if (!r.ok || !j?.ok) {
      const msg =
        j?.error ||
        (r.status === 404 ? 'Check-in service not found.' : '') ||
        (r.status === 401 ? 'That station code/secret doesn’t match.' : '') ||
        `Login failed (HTTP ${r.status})`;
      return { ok: false as const, err: msg };
    }

    const label = j?.station?.name || `${stationCode.trim()} • ${eventSlug.trim().replace(/-/g, ' ')}`;
    return { ok: true as const, label };
  };

  const disarm = async () => {
    try {
      await fetch(API.disarm, { method: 'DELETE' });
    } catch {}
  };

  // setup link: /scan?slug=...&code=...&secret=...&auto=1
  useEffect(() => {
    const u = new URL(window.location.href);
    const slug = u.searchParams.get('slug');
    const code = u.searchParams.get('code');
    const secret = u.searchParams.get('secret');
    const auto = u.searchParams.get('auto');
    if (slug) setEventSlug(slug);
    if (code) setStationCode(code);
    if (secret) setStationSecret(secret);
    if (auto === '1' && slug && code && secret) setTimeout(() => void handleLogin(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    (async () => {
      try {
        const s = await tryStatus();
        if (!cancelled && s.armed) {
          setArmed(true);
          if (s.slug) setEventSlug(s.slug);
          setStationName(s.label || stationCode);
          return;
        }
      } catch {}
      setTimeout(() => slugRef.current?.focus(), 50);
    })();

    const id = window.setInterval(() => setQueueCount(getQueueSize(eventSlug)), 2500);

    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  async function handleLogin(e?: FormEvent) {
    e?.preventDefault?.();
    setPending(true);
    setLoginError(null);

    try {
      const res = await arm();
      if (!res.ok) {
        setLoginError(res.err);
        return;
      }

      setStationName(res.label);
      setArmed(true);
      setStationSecret('');
      setQueueCount(getQueueSize(eventSlug));

      if (navigator.onLine) void refreshOfflineTokenSet(eventSlug);
      setTimeout(() => secretRef.current?.blur(), 0);
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed');
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    await disarm();
    setArmed(false);
    setStationName('');
    setStationSecret('');
    setLoginError(null);
    setPending(false);
    setTimeout(() => slugRef.current?.focus(), 50);
  }

  return (
    <main className="py-10 container-page">
      <div className="max-w-3xl p-6 mx-auto a-card">
        {!armed ? (
          <form onSubmit={handleLogin}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h1 className="h-section">Scanner Station</h1>
              <span
                className={[
                  'text-[11px] px-2 py-1 rounded-full border',
                  online
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-200',
                ].join(' ')}
              >
                {online ? 'Online' : 'Offline'}
              </span>
            </div>

            <p className="mb-5 text-sm text-white/70">
              Enter the event code, station ID, and the one-time station secret from your Admin panel.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">Event</label>
                <input
                  ref={slugRef}
                  className={inputClass}
                  placeholder="prime-expo-2025"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="label">Station</label>
                <input
                  className={inputClass}
                  placeholder="S1"
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </div>

              <div>
                <label className="label">Secret</label>
                <input
                  ref={secretRef}
                  className={inputClass}
                  placeholder="Paste the secret"
                  type="password"
                  value={stationSecret}
                  onChange={(e) => setStationSecret(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </div>
            </div>

            {loginError && <div className="mt-3 text-sm font-medium text-rose-300">{loginError}</div>}

            <div className="flex flex-wrap items-center gap-3 mt-5">
              <button
                type="submit"
                className="a-btn a-btn--primary"
                disabled={pending || !eventSlug.trim() || !stationCode.trim() || !stationSecret.trim()}
                aria-disabled={pending}
              >
                {pending ? 'Authorizing…' : 'Arm Station'}
              </button>

              <span className="text-xs text-white/60">You’ll enter live scanning after login.</span>
            </div>
          </form>
        ) : (
          <section className="grid gap-4">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-white/60">Active Station</div>
                <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  <span>{stationName || stationCode || 'Station'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                    LIVE
                  </span>
                  {queueCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-600/20 text-sky-200 border border-sky-500/40">
                      QUEUE {queueCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-white/55">Green = allow. Amber = already in. Red = stop.</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden border rounded-xl border-white/15 bg-black/20">
                  <button
                    className={`px-3 py-2 text-xs ${
                      mode === 'wedge' ? 'bg-white text-black font-semibold' : 'bg-transparent text-white/70'
                    }`}
                    onClick={() => setMode('wedge')}
                    type="button"
                  >
                    QR Gun
                  </button>
                  <button
                    className={`px-3 py-2 text-xs ${
                      mode === 'camera' ? 'bg-white text-black font-semibold' : 'bg-transparent text-white/70'
                    }`}
                    onClick={() => setMode('camera')}
                    type="button"
                  >
                    Camera
                  </button>
                </div>

                <button className="text-xs a-btn a-btn--ghost" disabled={pending} onClick={handleLogout} type="button">
                  Log out
                </button>
              </div>
            </header>

            {mode === 'wedge' ? (
              <CheckInScannerWedge slug={eventSlug} stationName={stationName} />
            ) : (
              <CheckInScannerCamera slug={eventSlug} stationName={stationName} />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
