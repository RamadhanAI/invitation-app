'use client';

import { useEffect, useState } from 'react';

type StatsPayload = {
  total: number;
  attended: number;
  noShows: number;
  perScanner: Record<string, number>;
};

export default function ScannerStats({ slug }: { slug: string }) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [adminOk, setAdminOk] = useState<boolean | null>(null); // null = unknown/loading
  const [loginKey, setLoginKey] = useState('');
  const [authPending, setAuthPending] = useState(false);

  // check existing session cookie
  async function checkSession() {
    try {
      const r = await fetch('/api/admin/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const j = await r.json().catch(() => null);
      setAdminOk(!!(r.ok && j?.ok));
    } catch {
      setAdminOk(false);
    }
  }

  // try login with key
  async function doLogin() {
    if (!loginKey.trim()) return;
    setAuthPending(true);
    try {
      const r = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: loginKey.trim() }),
      });
      const j = await r.json().catch(() => null);
      const pass = !!(r.ok && j?.ok);
      setAdminOk(pass);
      if (!pass) {
        alert('Invalid admin key');
      }
    } catch (e: any) {
      alert(e?.message || 'Login failed');
      setAdminOk(false);
    } finally {
      setAuthPending(false);
    }
  }

  // load stats from API (requires admin in most setups)
  async function loadStats() {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (res.status === 401) {
        // not authorized
        setErr('Unauthorized');
        setData(null);
        return;
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(json?.error || `Failed (${res.status})`);
        setData(null);
      } else {
        setErr(null);
        setData(json as StatsPayload);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      setData(null);
    }
  }

  // boot: first we check session, then attempt stats
  useEffect(() => {
    let alive = true;
    (async () => {
      await checkSession();
    })();
    return () => { alive = false; };
  }, []);

  // whenever adminOk becomes true, actually load stats
  useEffect(() => {
    if (adminOk) {
      void loadStats();
    }
  }, [adminOk]);

  // UI states
  if (adminOk === null) {
    return <div className="p-4 a-card a-muted">Checking admin session…</div>;
  }

  if (adminOk === false) {
    // ask for admin key to view stats
    return (
      <div className="max-w-sm p-4 border rounded-xl bg-white/5 border-white/10 a-card">
        <div className="mb-2 font-semibold">Admin authentication required</div>
        <div className="mb-3 text-xs opacity-70">
          Enter the admin key to view live attendance stats.
        </div>
        <input
          className="w-full mb-2 a-input"
          type="password"
          placeholder="Admin key"
          value={loginKey}
          onChange={(e) => setLoginKey(e.target.value)}
        />
        <button
          className="w-full a-btn a-btn--primary"
          disabled={authPending || !loginKey.trim()}
          onClick={doLogin}
        >
          {authPending ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    );
  }

  // adminOk === true
  if (err && !data) {
    return <div className="p-4 a-card a-error">Stats error: {err}</div>;
  }
  if (!data) {
    return <div className="p-4 a-card a-muted">Loading scanner stats…</div>;
  }

  const scanners = Object.entries(data.perScanner).sort((a,b)=>b[1]-a[1]);

  return (
    <div className="p-4 border a-card rounded-xl border-white/10">
      <div className="mb-2 font-semibold">Attendance Overview</div>
      <div className="flex gap-4 text-sm">
        <div>Total: <span className="font-bold">{data.total}</span></div>
        <div>Attended: <span className="font-bold text-green-400">{data.attended}</span></div>
        <div>No-Shows: <span className="font-bold text-yellow-400">{data.noShows}</span></div>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-xs text-white/60">By Scanner</div>
        <ul className="grid grid-cols-2 gap-2">
          {scanners.map(([name, count]) => (
            <li key={name} className="flex justify-between px-3 py-2 rounded-md bg-white/5">
              <span className="font-medium">{name}</span>
              <span className="text-white/80">{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
