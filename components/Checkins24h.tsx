'use client';

import { useMemo } from 'react';

type Row = { scannedAt?: string | null; checkedOutAt?: string | null };

export default function Checkins24h({ rows }: { rows: Row[] }) {
  // Build 24 hourly buckets ending "now"
  const data = useMemo(() => {
    const now = Date.now();
    const start = now - 24 * 60 * 60 * 1000;
    const checkins = (rows || [])
      .map(r => r.scannedAt ? new Date(r.scannedAt).getTime() : 0)
      .filter(t => t && t >= start && t <= now)
      .sort((a, b) => a - b);

    // cumulative by hour
    const buckets: { t: number; v: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const t = start + i * 60 * 60 * 1000;
      buckets.push({ t, v: 0 });
    }
    let idx = 0; let cum = 0;
    for (let i = 0; i < buckets.length; i++) {
      const end = buckets[i].t + 60 * 60 * 1000;
      while (idx < checkins.length && checkins[idx] < end) { cum++; idx++; }
      buckets[i].v = cum;
    }
    return buckets;
  }, [rows]);

  const W = 360, H = 160, P = 12;
  const ys = data.map(d => d.v);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(1, ...ys);
  const x = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - minY) / Math.max(1, maxY - minY)) * (H - 2 * P);

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(d.v).toFixed(2)}`)
    .join(' ');

  return (
    <div className="p-3 border rounded-xl bg-white/5 border-white/10">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="text-sm text-white/80">Check-ins (last 24h)</div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">live</span>
      </div>
      <svg width={W} height={H} role="img" aria-label="Check-ins last 24 hours">
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* frame */}
        <rect x="0.5" y="0.5" width={W-1} height={H-1} rx="12" fill="url(#bg)" className="stroke-white/10 fill-white/0" />
        {/* area */}
        <path d={`${path} L ${x(data.length -1)} ${H-P} L ${x(0)} ${H-P} Z`} fill="url(#fill)" opacity="0.18" />
        {/* line */}
        <path d={path} stroke="white" strokeWidth="2" fill="none" opacity="0.9" />
      </svg>
    </div>
  );
}
