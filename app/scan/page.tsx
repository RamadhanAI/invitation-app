'use client';

import { useEffect, useRef, useState } from 'react';
import CheckInScannerCamera from '@/components/CheckInScannerCamera';
import CheckInScannerWedge from '@/components/CheckInScannerWedge';

/**
 * This page prefers the modern "Arm Station" flow you posted.
 * It supports BOTH API shapes:
 *   1) /api/scanner/session            (POST = arm, DELETE = disarm, GET = status)
 *   2) /api/scan/arm (+ /status)       (POST = arm, DELETE = disarm, GET = status)
 * It will try the primary and transparently fall back to the other.
 */

const PRIMARY = {
  arm: '/api/scanner/session',
  status: '/api/scanner/session',
  disarm: '/api/scanner/session',
  shape: 'session' as const,
};

const FALLBACK = {
  arm: '/api/scan/arm',
  status: '/api/scan/arm/status',
  disarm: '/api/scan/arm',
  shape: 'arm' as const,
};

type ArmShape = typeof PRIMARY | typeof FALLBACK;

export default function ScanPage() {
  // ---- Phase 1: login inputs
  const [eventSlug, setEventSlug] = useState('prime-expo-2025');
  const [stationCode, setStationCode] = useState('S1');
  const [stationSecret, setStationSecret] = useState('');

  // ---- Phase 2: armed session
  const [armed, setArmed] = useState(false);
  const [stationName, setStationName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // ---- Scanner mode
  const [mode, setMode] = useState<'wedge' | 'camera'>('wedge');

  // ---- API autodetect
  const [api, setApi] = useState<ArmShape>(PRIMARY);

  const slugRef = useRef<HTMLInputElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);

  // -------- utilities
  const jsonOrNull = async (r: Response) => {
    try { return await r.json(); } catch { return null; }
  };

  const tryStatus = async (shape: ArmShape) => {
    const r = await fetch(shape.status, { method: 'GET', cache: 'no-store' });
    const j = await jsonOrNull(r);
    // normalize
    if (!r.ok) return { armed: false as const };

    if (shape.shape === 'session') {
      // expect { armed?: boolean, stationLabel?: string, station?: { name?: string } }
      return {
        armed: Boolean(j?.armed ?? j?.ok),
        label: j?.stationLabel || j?.station?.name || '',
      };
    } else {
      // expect { armed: boolean, stationLabel?: string }
      return {
        armed: Boolean(j?.armed),
        label: j?.stationLabel || '',
      };
    }
  };

  const armWith = async (shape: ArmShape) => {
    const body =
      shape.shape === 'session'
        ? { eventSlug: eventSlug.trim(), code: stationCode.trim(), secret: stationSecret.trim() }
        : { eventSlug: eventSlug.trim(), stationCode: stationCode.trim(), stationSecret: stationSecret.trim() };

    const r = await fetch(shape.arm, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await jsonOrNull(r);
    if (!r.ok || !(j?.ok ?? j?.armed)) {
      return { ok: false as const, err: j?.error || 'Unauthorized' };
    }

    // normalize station label/name
    const label =
      j?.stationLabel ||
      j?.station?.name ||
      `${stationCode.trim()} • ${eventSlug.trim().replace(/-/g, ' ')}`;

    return { ok: true as const, label };
  };

  const disarmWith = async (shape: ArmShape) => {
    await fetch(shape.disarm, { method: 'DELETE' });
  };

  // -------- on mount: autodetect API + existing session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try PRIMARY
      try {
        const s1 = await tryStatus(PRIMARY);
        if (!cancelled && s1?.armed) {
          setApi(PRIMARY);
          setArmed(true);
          setStationName(s1.label || stationCode);
          return;
        }
      } catch {}

      // Try FALLBACK
      try {
        const s2 = await tryStatus(FALLBACK);
        if (!cancelled && s2?.armed) {
          setApi(FALLBACK);
          setArmed(true);
          setStationName(s2.label || stationCode);
          return;
        }
      } catch {}

      // Neither armed; choose whichever responds
      try {
        await fetch(PRIMARY.status, { method: 'GET' });
        if (!cancelled) setApi(PRIMARY);
      } catch {
        setApi(FALLBACK);
      }

      // focus first field
      setTimeout(() => slugRef.current?.focus(), 50);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -------- actions
  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault?.();
    setPending(true);
    setLoginError(null);

    try {
      const res = await armWith(api);
      if (!res.ok) {
        // try the other API once
        const alt = api.shape === 'session' ? FALLBACK : PRIMARY;
        try {
          const res2 = await armWith(alt);
          if (!res2.ok) {
            setLoginError(res2.err);
            setPending(false);
            return;
          }
          setApi(alt);
          setStationName(res2.label);
          setArmed(true);
        } catch (err: any) {
          setLoginError(err?.message || 'Login failed');
        }
      } else {
        setStationName(res.label);
        setArmed(true);
      }

      setStationSecret(''); // wipe the secret
      setTimeout(() => secretRef.current?.blur(), 0);
    } catch (e: any) {
      setLoginError(e?.message || 'Login failed');
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    try {
      await disarmWith(api);
    } catch {}
    setArmed(false);
    setStationName('');
    setStationSecret('');
    setLoginError(null);
    setPending(false);
    setTimeout(() => slugRef.current?.focus(), 50);
  }

  // ---- UI
  return (
    <main className="py-10 text-white container-page">
      <div className="max-w-3xl p-6 mx-auto a-card">
        {!armed ? (
          /* ---------------------- PHASE 1: LOGIN / ARM ---------------------- */
          <form onSubmit={handleLogin}>
            <h1 className="mb-3 h-section">Scanner Login / Arm Station</h1>
            <p className="mb-4 text-sm text-white/70">
              Enter the event slug, the station code (like <code>S1</code>), and the one-time scanner secret from <strong>Admin → Stations</strong>.
              After login, this device is authorized for ~8 hours and can check people in.
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="label">Event Slug</label>
                <input
                  ref={slugRef}
                  className="text-black input"
                  placeholder="prime-expo-2025"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="label">Station Code</label>
                <input
                  className="text-black input"
                  placeholder="S1"
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="label">Station Secret</label>
                <input
                  ref={secretRef}
                  className="text-black input"
                  placeholder="(paste secret)"
                  type="password"
                  value={stationSecret}
                  onChange={(e) => setStationSecret(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {loginError && (
              <div className="mt-3 text-sm font-medium text-red-400">{loginError}</div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="submit"
                className="a-btn a-btn--primary"
                disabled={pending || !eventSlug.trim() || !stationCode.trim() || !stationSecret.trim()}
                aria-disabled={pending}
              >
                {pending ? 'Authorizing…' : 'Sign In / Arm Scanner'}
              </button>
              <span className="text-xs text-white/60">After success, you’ll switch to LIVE SCAN mode.</span>
              <span className="ml-auto text-[10px] opacity-50">
                API: <code>{api.shape}</code>
              </span>
            </div>
          </form>
        ) : (
          /* ---------------------- PHASE 2: LIVE SCAN ----------------------- */
          <section className="grid gap-4">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm opacity-70">Armed Station</div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <span>{stationName || stationCode || 'Active Station'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-600/20 text-green-400 border border-green-500/40">
                    LIVE
                  </span>
                </div>
                <div className="text-[11px] opacity-60">
                  This device can now check in attendees. Green = let them in. Red = stop and call supervisor.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex overflow-hidden border rounded-lg border-white/20">
                  <button
                    className={`px-3 py-1 text-xs ${mode === 'wedge' ? 'bg-white text-black font-semibold' : 'bg-transparent text-white/70'}`}
                    onClick={() => setMode('wedge')}
                    type="button"
                  >
                    QR Gun
                  </button>
                  <button
                    className={`px-3 py-1 text-xs ${mode === 'camera' ? 'bg-white text-black font-semibold' : 'bg-transparent text-white/70'}`}
                    onClick={() => setMode('camera')}
                    type="button"
                  >
                    Camera
                  </button>
                </div>

                <button className="text-xs a-btn a-btn--ghost" disabled={pending} onClick={handleLogout} type="button">
                  Log Out
                </button>
              </div>
            </header>

            <div className="grid gap-6">
              {mode === 'wedge' ? (
                <CheckInScannerWedge stationName={stationName} />
              ) : (
                <CheckInScannerCamera stationName={stationName} />
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
