// components/Admin/ScannerStats.tsx
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

  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  function loginRedirectHref() {
    // If stats view belongs to /admin/events/[slug], send them back there after login.
    const nextUrl = `/admin/events/${encodeURIComponent(slug)}`;
    return `/login?next=${encodeURIComponent(nextUrl)}`;
  }

  async function loadStats() {
    setLoading(true);
    try {
      // This endpoint should already be protected on the server using the same cookie check.
      // If it's still using legacy auth, we'll need to update it exactly like we did for stations.
      const res = await fetch(
        `/api/events/${encodeURIComponent(slug)}/attendance`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        setData(null);
        setErr(null);
        setLoading(false);
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setErr(json?.error || `Failed (${res.status})`);
        setData(null);
      } else {
        setErr(null);
        setData(json as StatsPayload);
        setSessionExpired(false);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Load once on mount
  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // --- render states -------------------------------------------------------

  if (sessionExpired) {
    return (
      <div className="max-w-sm p-4 border rounded-xl bg-white/5 border-white/10 a-card">
        <div className="mb-2 font-semibold">Session expired</div>
        <div className="mb-3 text-xs opacity-70">
          Please log in again to view live attendance stats.
        </div>
        <a
          className="block w-full text-center a-btn a-btn--primary"
          href={loginRedirectHref()}
        >
          Log in
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 a-card a-muted">
        Loading scanner stats…
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="p-4 a-card a-error">
        Stats error: {err}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 a-card a-muted">
        No stats available.
      </div>
    );
  }

  const scanners = Object.entries(data.perScanner).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="p-4 border a-card rounded-xl border-white/10">
      <div className="mb-2 font-semibold">Attendance Overview</div>

      <div className="flex gap-4 text-sm">
        <div>
          Total:{' '}
          <span className="font-bold">{data.total}</span>
        </div>
        <div>
          Attended:{' '}
          <span className="font-bold text-green-400">
            {data.attended}
          </span>
        </div>
        <div>
          No-Shows:{' '}
          <span className="font-bold text-yellow-400">
            {data.noShows}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs text-white/60">
          By Scanner
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {scanners.map(([scannerName, count]) => (
            <li
              key={scannerName}
              className="flex justify-between px-3 py-2 rounded-md bg-white/5"
            >
              <span className="font-medium">
                {scannerName}
              </span>
              <span className="text-white/80">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
