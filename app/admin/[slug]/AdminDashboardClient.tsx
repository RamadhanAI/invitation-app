'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';

/* ------------------------------------------------------------------
   Types (mirror what server sends)
-------------------------------------------------------------------*/

type Attendance = { total: number; attended: number; noShows: number };

export type Registration = {
  email: string;
  attended: boolean;
  registeredAt: string;
  scannedAt: string | null;
  scannedBy: string | null;
  checkedOutAt?: string | null;
  checkedOutBy?: string | null;
  qrToken: string;
  meta?: unknown;
};

export type TickerItem = {
  ts: string;        // ISO
  action: string;    // "IN" | "OUT" | "DENY"
  station: string;   // "VIP ENTRANCE", etc
  name: string;      // attendee name
  role: string;      // VIP / STAFF / etc
};

type Props = {
  slug: string;
  title: string;
  attendance: Attendance;
  capacity: number | null;
  initialRegistrations: Registration[];
  recentEvents: TickerItem[];
};

/* ------------------------------------------------------------------
   Helpers for meta (name/company from CSV/meta blob)
-------------------------------------------------------------------*/

function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

function fullName(meta: unknown): string {
  const m = parseMeta(meta);
  const cands = [
    m['fullName'],
    m['name'],
    [m['firstName'], m['lastName']].filter(Boolean).join(' '),
    [m['firstname'], m['lastname']].filter(Boolean).join(' '),
    [m['givenName'], m['familyName']].filter(Boolean).join(' '),
  ]
    .map((v) => (v || '').toString().trim())
    .filter(Boolean);
  return cands[0] || '';
}

function companyFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  return (
    (m['companyName'] || m['company'] || m['org'] || '') as string
  ).toString().trim();
}

/* ------------------------------------------------------------------
   Animated number component for KPI cards
-------------------------------------------------------------------*/

function CountUp({ value }: { value: number }): JSX.Element {
  const mv = useMotionValue(0);
  const fmt = useTransform(mv, (v: number) => Math.round(v).toLocaleString());
  const [text, setText] = useState<string>('0');

  useEffect(() => {
    const c = animate(mv, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    });
    const off = fmt.on('change', (v) => setText(v));
    return () => {
      c.stop();
      off();
    };
  }, [value, fmt, mv]);

  return <span className="text-3xl font-bold">{text}</span>;
}

/* ------------------------------------------------------------------
   Tiny sparkline (visually "check-ins last 24h")
-------------------------------------------------------------------*/

function AreaChart({
  data,
  w = 520,
  h = 140,
}: {
  data: number[];
  w?: number;
  h?: number;
}): JSX.Element {
  const pad = 10;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((y, i) => [
    pad + i * step,
    h - pad - (y / max) * (h - pad * 2),
  ]) as Array<[number, number]>;

  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
  const poly = `${d} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <svg width={w} height={h} role="img" aria-label="Check-ins (last 24h)">
      <defs>
        <linearGradient id="admGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#111827" stopOpacity=".25" />
          <stop offset="100%" stopColor="#111827" stopOpacity=".04" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx={14} fill="#fff" />
      <AnimatePresence>
        <motion.path
          key="fill"
          d={poly}
          fill="url(#admGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        <motion.path
          key="stroke"
          d={d}
          fill="none"
          stroke="#111827"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1 }}
        />
      </AnimatePresence>
    </svg>
  );
}

/* ------------------------------------------------------------------
   Capacity Thermometer
   - Shows how full we are vs capacity
   - <70% calm gray/blue
   - 70-90% pulsing gold
   - >90% ember/red alert
-------------------------------------------------------------------*/

function CapacityThermometer({
  inside,
  capacity,
}: {
  inside: number; // attendance.attended
  capacity: number | null;
}) {
  if (!capacity || capacity <= 0) {
    return (
      <div className="text-xs text-[color:var(--muted)]">
        Capacity not set
      </div>
    );
  }

  const pctRaw = (inside / capacity) * 100;
  const pct = Math.min(100, Math.max(0, pctRaw));

  let barColor = 'bg-slate-400';
  let glowColor = 'shadow-[0_0_20px_rgba(148,163,184,0.4)]';
  let labelColor = 'text-slate-300';

  if (pct >= 70 && pct < 90) {
    barColor = 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-300';
    glowColor = 'shadow-[0_0_24px_rgba(251,191,36,0.6)] animate-pulse';
    labelColor = 'text-amber-300';
  } else if (pct >= 90) {
    barColor = 'bg-gradient-to-r from-red-500 via-amber-500 to-yellow-400';
    glowColor = 'shadow-[0_0_28px_rgba(248,113,113,0.8)] animate-pulse';
    labelColor = 'text-red-400';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] leading-none">
        <div className={labelColor + ' font-semibold tracking-wide'}>
          {pct.toFixed(0)}% capacity
        </div>
        <div className="text-[color:var(--muted)]">
          {inside.toLocaleString()} / {capacity.toLocaleString()}
        </div>
      </div>
      <div className="w-full h-2 overflow-hidden border rounded bg-white/10 border-white/10">
        <div
          className={`h-full ${barColor} ${glowColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Recent Scans Ticker
   - Shows last ~10 AttendanceEvent rows
   - “14:07 IN VIP ENTRANCE — ALEX J (VIP)”
-------------------------------------------------------------------*/

function RecentTicker({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-xs text-[color:var(--muted)]">
        No scans yet.
      </div>
    );
  }

  return (
    <div className="text-xs font-mono leading-relaxed max-h-[180px] overflow-y-auto pr-1">
      {items.map((row, i) => {
        // time HH:MM
        const t = new Date(row.ts);
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');

        // color by action
        let actionColor = 'text-white';
        if (row.action === 'IN') actionColor = 'text-green-400';
        else if (row.action === 'OUT') actionColor = 'text-amber-400';
        else if (row.action === 'DENY') actionColor = 'text-red-400';

        const roleShort = row.role?.toUpperCase?.() || '';
        const station = row.station || '';

        return (
          <div
            key={i}
            className="flex flex-wrap gap-1 py-1 border-b border-white/10 last:border-0"
          >
            <span className="text-white/40">{hh}:{mm}</span>
            <span className={actionColor + ' font-semibold'}>
              {row.action}
            </span>
            {station && (
              <span className="text-white/60">{station}</span>
            )}
            <span className="text-white/80 truncate max-w-[14rem] font-semibold">
              {row.name}
            </span>
            {roleShort && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 leading-none self-start">
                {roleShort}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   AdminDashboardClient
   - You land here after server auth passed in /admin/events/[slug]/page.tsx
   - Uses cookie session, not x-api-key
   - Handles bulk mark attended / checkout / CSV export
-------------------------------------------------------------------*/

export default function AdminDashboardClient({
  slug,
  title,
  attendance,
  capacity,
  initialRegistrations,
  recentEvents,
}: Props): JSX.Element {
  // sessionExpired === true means a 401 came back from server APIs
  const [sessionExpired, setSessionExpired] = useState(false);

  // table / filters / selection / pending
  const [rows, setRows] = useState<Registration[]>(initialRegistrations);
  const [q, setQ] = useState<string>('');
  const [onlyAttended, setOnlyAttended] = useState<boolean>(false);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState<boolean>(false);
  const [pending, setPending] = useState<boolean>(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  // derived stats from current table client-side
  const total = attendance?.total ?? rows.length;
  const checkedIn = rows.filter((r) => r.attended).length;
  const noShows = Math.max(0, total - checkedIn);

  /* ---------- filter logic ---------- */
  const filtered = useMemo<Registration[]>(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyAttended && !r.attended) return false;
      if (onlyCheckedIn && !r.scannedAt) return false;
      if (!query) return true;

      if (r.email.toLowerCase().includes(query)) return true;
      if (r.qrToken?.toLowerCase().includes(query)) return true;

      try {
        return (r.meta ? JSON.stringify(r.meta).toLowerCase() : '').includes(
          query
        );
      } catch {
        return false;
      }
    });
  }, [rows, q, onlyAttended, onlyCheckedIn]);

  const selectedTokens = useMemo<string[]>(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );
  const someSelected = selectedTokens.length > 0;
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected[r.qrToken]);

  const toggleAllVisible = (v: boolean): void =>
    setSelected((prev) => {
      const n: Record<string, boolean> = { ...prev };
      filtered.forEach((r) => (n[r.qrToken] = v));
      return n;
    });

  const toggleOne = (t: string): void =>
    setSelected((p) => ({
      ...p,
      [t]: !p[t],
    }));

  // helper to send back to /login with redirect
  function loginRedirectHref() {
    return `/login?next=${encodeURIComponent(`/admin/events/${slug}`)}`;
  }

  /* ---------- SERVER MUTATIONS via cookie session ---------- */

  async function bulkPatch(body: {
    tokens?: string[];
    attended?: boolean;
    checkedOut?: boolean;
  }): Promise<void> {
    if (!someSelected) return;
    setPending(true);

    try {
      const res = await fetch(
        `/api/admin/events/${encodeURIComponent(slug)}/registration/bulk`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            station: 'Admin Bulk',
          }),
        }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        rows?: Registration[];
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Bulk action failed');
      }

      const updated: Registration[] = json.rows ?? [];
      setRows((prev) =>
        prev.map((r) => {
          const u = updated.find((x) => x.qrToken === r.qrToken);
          return u ? { ...r, ...u } : r;
        })
      );
    } catch (e) {
      console.error('bulkPatch error', e);
    } finally {
      setPending(false);
    }
  }

  async function patchOne(
    token: string,
    next: { attended?: boolean; checkedOut?: boolean }
  ): Promise<void> {
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/events/${encodeURIComponent(slug)}/registration`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            station: 'Admin UI',
            ...next,
          }),
        }
      );

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        registration: Registration;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Action failed');
      }

      const updated = json.registration;
      setRows((prev) =>
        prev.map((r) => (r.qrToken === token ? { ...r, ...updated } : r))
      );
    } catch (e) {
      console.error('patchOne error', e);
    } finally {
      setPending(false);
    }
  }

  /* ---------- CSV IMPORT ---------- */

  const importUrlBase = `/api/admin/events/${encodeURIComponent(slug)}/registration/import`;

  async function onCsvPicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setPending(true);

    try {
      const fd = new FormData();
      fd.set('file', file);

      const res = await fetch(importUrlBase, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Import failed (${res.status})`);
      }

      // simplest brute refresh to show new regs
      window.location.reload();
    } catch (err) {
      alert(
        ((err as { message?: string } | null)?.message) || 'Import failed'
      );
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /* ---------- CSV EXPORT (selected) ---------- */

  function exportSelectedCsv(): void {
    if (!someSelected) return;
    const sel = rows.filter((r) => selected[r.qrToken]);
    const header = [
      'name',
      'company',
      'email',
      'attended',
      'registeredAt',
      'scannedAt',
      'scannedBy',
      'checkedOutAt',
      'checkedOutBy',
      'qrToken',
    ];
    const esc = (v: string): string =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

    const lines = sel.map((r) =>
      [
        fullName(r.meta) || '',
        companyFromMeta(r.meta) || '',
        r.email,
        r.attended,
        r.registeredAt,
        r.scannedAt ?? '',
        r.scannedBy ?? '',
        r.checkedOutAt ?? '',
        r.checkedOutBy ?? '',
        r.qrToken,
      ]
        .map((x) => esc(String(x)))
        .join(',')
    );

    const csv = [header.join(','), ...lines].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-selected-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- sparkline data just for visuals ---------- */
  const spark = useMemo(() => {
    // quick fake curve based on totals so chart animates
    const base = Math.max(6, Math.min(24, Math.round(total / 2)));
    const arr = Array.from({ length: base }, (_, i) =>
      Math.max(1, Math.round(((i + 1) * (checkedIn + 2)) / base))
    );
    return arr;
  }, [total, checkedIn]);

  /* ------------------------------------------------------------------
     RENDER
  -------------------------------------------------------------------*/

  if (sessionExpired) {
    return (
      <div className="max-w-xl p-6 mx-auto space-y-4 a-card">
        <div className="text-lg font-semibold">Session expired</div>
        <div className="text-sm text-[color:var(--muted)] mb-2">
          Your admin session is no longer valid. Please log in again.
        </div>
        <a
          href={loginRedirectHref()}
          className="block w-full text-center a-btn a-btn--primary"
        >
          Log in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER / CONTROLS */}
      <div className="p-4 a-card md:p-6 banana-sheen-hover">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xl font-semibold">{title}</div>
            <div className="text-sm text-[color:var(--muted)]">
              Admin dashboard
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              className="a-btn a-btn--accent"
              href={`/admin/events/${encodeURIComponent(slug)}/stations`}
            >
              Manage Scanners
            </Link>
            <Link
              href="/admin/events/new"
              className="a-btn a-btn--ghost"
            >
              New Event
            </Link>
            <Link
              href="/scan"
              className="a-btn a-btn--strong"
            >
              Open Scanner
            </Link>
          </div>
        </div>
      </div>

      {/* CSV BAR */}
      <div className="p-4 a-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">CSV In & Out</div>
            <div className="text-xs text-[color:var(--muted)] max-w-[60ch]">
              Import columns: <code>email</code> (required),
              <code>price</code>, <code>firstName</code>,{' '}
              <code>lastName</code>, <code>companyName</code>,{' '}
              <code>jobTitle</code>, …
            </div>
          </div>
          <a
            className="a-btn a-btn--ghost"
            href={`/admin/api/events/${encodeURIComponent(slug)}/export.csv`}
          >
            Export CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e): void => {
              void onCsvPicked(e);
            }}
            className="a-input-file"
          />
          <button
            className="a-btn"
            onClick={(): void => fileRef.current?.click()}
          >
            Choose File
          </button>
          <button
            className="a-btn a-btn--primary"
            onClick={(): void => {
              if (fileRef.current?.files?.[0])
                void onCsvPicked({ currentTarget: fileRef.current } as any);
            }}
          >
            Import CSV
          </button>
        </div>
      </div>

      {/* KPI GRID + CAPACITY + TICKER */}
      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        {/* Total */}
        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">
            TOTAL REGISTRATIONS
          </div>
          <CountUp value={total} />
        </div>

        {/* Checked-in */}
        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">CHECKED-IN</div>
          <CountUp value={checkedIn} />
        </div>

        {/* No-shows */}
        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">NO-SHOWS</div>
          <CountUp value={noShows} />
        </div>

        {/* Capacity Thermometer */}
        <div className="flex flex-col justify-between p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)] mb-2">
            VENUE CAPACITY
          </div>
          <CapacityThermometer
            inside={checkedIn}
            capacity={capacity}
          />
        </div>
      </motion.div>

      {/* Chart + Action Center + Live Ticker */}
      <div className="a-bleed">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Chart */}
          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                Check-ins (last 24h)
              </div>
              <div className="text-xs text-[color:var(--muted)]">live</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[color:var(--line)] bg-white">
              <AreaChart data={spark} />
            </div>
          </div>

          {/* Action Center */}
          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="mb-2 text-sm font-medium">Action Center</div>

            <button
              className="w-full mb-2 a-btn a-btn--accent"
              disabled={!someSelected || pending}
              onClick={(): void => {
                void bulkPatch({
                  tokens: selectedTokens,
                  attended: true,
                  checkedOut: false,
                });
              }}
            >
              Mark selected as Paid
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="w-full a-btn"
                disabled={!someSelected || pending}
                onClick={(): void => {
                  void bulkPatch({
                    tokens: selectedTokens,
                    attended: true,
                    checkedOut: false,
                  });
                }}
                title="Mark selected Attended"
              >
                Mark selected Attended
              </button>

              <button
                className="w-full a-btn a-btn--ghost"
                disabled={!someSelected || pending}
                onClick={(): void => {
                  void bulkPatch({
                    tokens: selectedTokens,
                    attended: false,
                  });
                }}
                title="Remove from Attendance"
              >
                Remove from Attendance
              </button>
            </div>

            <button
              className="w-full mt-2 a-btn"
              disabled={!someSelected || pending}
              onClick={(): void => exportSelectedCsv()}
            >
              Export Selected (CSV)
            </button>

            <div className="mt-4">
              <div className="mb-2 text-sm font-medium">CSV In & Out</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="w-full a-btn"
                  onClick={(): void => fileRef.current?.click()}
                >
                  Import CSV
                </button>
                <a
                  className="w-full text-center a-btn a-btn--ghost whitespace-nowrap"
                  href={`/admin/api/events/${encodeURIComponent(
                    slug
                  )}/export.csv`}
                >
                  Export All (CSV)
                </a>
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                CSV must include <code>email</code>. Optional:{' '}
                <code>price</code>, <code>firstName</code>,{' '}
                <code>lastName</code>, <code>companyName</code>,{' '}
                <code>jobTitle</code>, …
              </div>
            </div>
          </div>

          {/* Live Ticker */}
          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="mb-2 text-sm font-medium">
              Live Gate Activity
            </div>
            <RecentTicker items={recentEvents} />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="p-3 a-card">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            className="a-input"
            placeholder="Search name, email, token, scanner, or meta…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyAttended}
              onChange={(e) => setOnlyAttended(e.currentTarget.checked)}
            />
            Only attended
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyCheckedIn}
              onChange={(e) => setOnlyCheckedIn(e.currentTarget.checked)}
            />
            Only checked-in
          </label>

          <div className="ml-auto">
            <button
              className="a-btn a-btn--ghost"
              onClick={(): void => {
                setQ('');
                setOnlyAttended(false);
                setOnlyCheckedIn(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="a-bleed">
        <div className="overflow-auto a-card banana-sheen-hover a-table-wrap">
          <table className="w-full a-table a-table--dense a-table--tight a-table--wide">
            <thead>
              <tr>
                <th className="a-th">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e): void =>
                      toggleAllVisible(e.currentTarget.checked)
                    }
                  />
                </th>
                <th className="a-th a-col-name">Name / Company</th>
                <th className="a-th a-col-email">Email</th>
                <th className="a-th a-col-attended">Attended</th>
                <th className="a-th a-col-datetime">Registered</th>
                <th className="a-th a-col-datetime">Scanned</th>
                <th className="a-th">Scanned By</th>
                <th className="a-th a-col-datetime">Checked-out</th>
                <th className="a-th a-col-actions">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 && (
                <tr className="a-tr">
                  <td className="text-gray-500 a-td" colSpan={9}>
                    No results.
                  </td>
                </tr>
              )}

              {filtered.map((r) => {
                const canRemove = r.attended;
                const canCheckout = r.attended && !r.checkedOutAt;

                return (
                  <tr key={r.qrToken} className="a-tr">
                    <td className="a-td">
                      <input
                        type="checkbox"
                        checked={!!selected[r.qrToken]}
                        onChange={(): void => toggleOne(r.qrToken)}
                      />
                    </td>

                    <td className="a-td a-col-name">
                      <div className="font-medium cell-wrap">
                        {fullName(r.meta) || '—'}
                      </div>
                      {companyFromMeta(r.meta) && (
                        <div className="text-xs text-[color:var(--muted)] cell-wrap">
                          {companyFromMeta(r.meta)}
                        </div>
                      )}
                    </td>

                    <td className="a-td a-col-email">
                      <div className="font-mono cell-ellipsis">{r.email}</div>
                    </td>

                    <td className="a-td a-col-attended">
                      {r.attended ? 'Yes' : 'No'}
                    </td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">
                        {new Date(r.registeredAt).toLocaleString()}
                      </div>
                    </td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">
                        {r.scannedAt
                          ? new Date(r.scannedAt).toLocaleString()
                          : '—'}
                      </div>
                    </td>

                    <td className="a-td">
                      <div className="cell-ellipsis">{r.scannedBy || '—'}</div>
                    </td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">
                        {r.checkedOutAt
                          ? new Date(r.checkedOutAt).toLocaleString()
                          : '—'}
                      </div>
                    </td>

                    <td className="a-td a-col-actions">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* MARK ATTENDED */}
                        <button
                          className="a-btn"
                          disabled={pending || r.attended}
                          onClick={(): void => {
                            void patchOne(r.qrToken, {
                              attended: true,
                              checkedOut: false,
                            });
                          }}
                          title={
                            r.attended
                              ? 'Already attended'
                              : 'Mark Attended'
                          }
                        >
                          Mark Attended
                        </button>

                        {/* REMOVE ATTENDANCE */}
                        <button
                          className="a-btn a-btn--ghost"
                          disabled={pending || !canRemove}
                          onClick={(): void => {
                            void patchOne(r.qrToken, {
                              attended: false,
                            });
                          }}
                          title={
                            !canRemove
                              ? 'Not attended yet'
                              : 'Remove from Attendance'
                          }
                        >
                          Remove
                        </button>

                        {/* CHECK OUT */}
                        <button
                          className="a-btn"
                          disabled={pending || !canCheckout}
                          onClick={(): void => {
                            void patchOne(r.qrToken, {
                              checkedOut: true,
                            });
                          }}
                          title={
                            !canCheckout
                              ? 'Must be attended and not already checked out'
                              : 'Check-out'
                          }
                        >
                          Check-out
                        </button>

                        {/* VIEW BADGE */}
                        <a
                          className="a-btn a-btn--ghost whitespace-nowrap min-w-[7.5rem] text-center"
                          href={`/t/${encodeURIComponent(
                            r.qrToken
                          )}?view=badge`}
                          target="_blank"
                          rel="noreferrer"
                          title="View ticket (badge)"
                        >
                          View Ticket
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
