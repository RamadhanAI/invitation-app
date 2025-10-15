'use client';
import { useEffect, useState } from 'react';

type Props = { slug: string; token?: string; }; // token optional if you gate with cookie/proxy

export default function ScannerStats({ slug }: Props) {
  const [data, setData] = useState<{ total: number; attended: number; noShows: number; perScanner: Record<string, number> } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance`, {
          headers: { 'x-api-key': '' } // use admin proxy if you have it; else leave empty (server will gate)
        });
        const json = await res.json();
        if (alive) {
          if (!res.ok) setErr(json?.error || 'Failed');
          else setData(json);
        }
      } catch (e: any) {
        if (alive) setErr(String(e?.message || e));
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (err) return <div className="a-card a-error">Stats error: {err}</div>;
  if (!data) return <div className="a-card a-muted">Loading scanner stats…</div>;

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
