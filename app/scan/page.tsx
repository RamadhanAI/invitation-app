// app/scan/page.tsx
// app/scan/page.tsx
'use client';

import { useState } from 'react';
import CheckInScannerCamera from '@/components/CheckInScannerCamera';
import CheckInScannerWedge from '@/components/CheckInScannerWedge';

export default function ScanPage() {
  // Phase 1: station login inputs
  const [eventSlug, setEventSlug] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [stationSecret, setStationSecret] = useState('');

  // Phase 2: armed scanner session
  const [armed, setArmed] = useState(false);
  const [stationName, setStationName] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Which scanning mode to show live
  const [mode, setMode] = useState<'wedge' | 'camera'>('wedge');

  async function handleLogin() {
    setPending(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/scanner/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventSlug: eventSlug.trim(),
          code: stationCode.trim(),
          secret: stationSecret.trim(),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setLoginError(json?.error || 'Login failed');
        setPending(false);
        return;
      }

      // Success: server sets scan_sess httpOnly cookie
      setStationName(json.station?.name || stationCode.trim());
      setArmed(true);

      // wipe secret from UI
      setStationSecret('');
    } catch (e: any) {
      setLoginError(e?.message || 'Login failed');
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    try {
      await fetch('/api/scanner/session', { method: 'DELETE' });
    } catch {
      // ignore network error, we'll reset anyway
    } finally {
      setArmed(false);
      setStationName('');
      setStationSecret('');
      setLoginError(null);
      setPending(false);
    }
  }

  return (
    <main className="grid max-w-4xl gap-6 p-4 mx-auto text-white">
      {!armed ? (
        /* ---------------------- PHASE 1: LOGIN / ARM ---------------------- */
        <section className="p-4 border rounded-xl border-white/10 bg-white/5">
          <h1 className="mb-3 text-lg font-semibold">
            Scanner Login / Arm Station
          </h1>

          <p className="mb-4 text-sm opacity-70">
            Enter the event slug, the station code (like S1),
            and the one-time scanner secret from Admin → Stations.
            After login, this device is authorized for ~8 hours and can check people in.
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col">
              <label className="mb-1 text-xs opacity-70">Event Slug</label>
              <input
                className="text-black a-input"
                placeholder="prime-expo-2025"
                value={eventSlug}
                onChange={(e) => setEventSlug(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-xs opacity-70">Station Code</label>
              <input
                className="text-black a-input"
                placeholder="S1"
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value)}
              />
            </div>

            <div className="flex flex-col md:col-span-1">
              <label className="mb-1 text-xs opacity-70">Station Secret</label>
              <input
                className="text-black a-input"
                placeholder="(paste secret)"
                type="password"
                value={stationSecret}
                onChange={(e) => setStationSecret(e.target.value)}
              />
            </div>
          </div>

          {loginError && (
            <div className="mt-3 text-sm font-medium text-red-400">
              {loginError}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              className="a-btn a-btn--primary"
              disabled={
                pending ||
                !eventSlug.trim() ||
                !stationCode.trim() ||
                !stationSecret.trim()
              }
              onClick={handleLogin}
            >
              {pending ? 'Authorizing…' : 'Sign In / Arm Scanner'}
            </button>

            <div className="self-center text-xs opacity-70">
              After success, you’ll switch to LIVE SCAN mode.
            </div>
          </div>
        </section>
      ) : (
        /* ---------------------- PHASE 2: LIVE SCAN ----------------------- */
        <section className="grid gap-4 p-4 border rounded-xl border-white/10 bg-white/5">
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
                This device can now check in attendees.
                Green = let them in.
                Red = stop and call supervisor.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden border rounded-lg border-white/20">
                <button
                  className={`px-3 py-1 text-xs ${
                    mode === 'wedge'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-transparent text-white/70'
                  }`}
                  onClick={() => setMode('wedge')}
                >
                  QR Gun
                </button>
                <button
                  className={`px-3 py-1 text-xs ${
                    mode === 'camera'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-transparent text-white/70'
                  }`}
                  onClick={() => setMode('camera')}
                >
                  Camera
                </button>
              </div>

              <button
                className="text-xs a-btn a-btn--ghost"
                disabled={pending}
                onClick={handleLogout}
              >
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
    </main>
  );
}
