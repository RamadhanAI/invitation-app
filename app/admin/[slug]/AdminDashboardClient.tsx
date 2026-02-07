'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';

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
  ts: string;
  action: string;
  station: string;
  name: string;
  role: string;
};

// Must match lib/badgeConfig.ts types
type BadgeTemplate =
  | 'midnight_gold'
  | 'pearl_white'
  | 'obsidian'
  | 'emerald'
  | 'royal_blue'
  | 'sunrise';

type BadgeBg = 'dark' | 'light';

type BadgeConfig = {
  template?: BadgeTemplate;
  accent?: string; // hex
  bg?: BadgeBg;
  logoUrl?: string; // https
  sponsorLogoUrl?: string; // https
};

type Props = {
  slug: string;
  title: string;
  attendance: Attendance;
  capacity: number | null;
  initialRegistrations: Registration[];
  recentEvents: TickerItem[];
  // ✅ NEW
  badgeConfig?: BadgeConfig;
  badgeStudioUrl?: string;
};

function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
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
  return ((m['companyName'] || m['company'] || m['org'] || '') as string).toString().trim();
}

function CountUp({ value }: { value: number }): JSX.Element {
  const mv = useMotionValue(0);
  const fmt = useTransform(mv, (v: number) => Math.round(v).toLocaleString());
  const [text, setText] = useState<string>('0');

  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    const off = fmt.on('change', (v) => setText(v));
    return () => {
      c.stop();
      off();
    };
  }, [value, fmt, mv]);

  return <span className="text-3xl font-bold">{text}</span>;
}

function AreaChart({ data, w = 520, h = 140 }: { data: number[]; w?: number; h?: number }): JSX.Element {
  const pad = 10;
  const max = Math.max(...data, 1);
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((y, i) => [pad + i * step, h - pad - (y / max) * (h - pad * 2)]) as Array<[number, number]>;
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
        <motion.path key="fill" d={poly} fill="url(#admGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
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

function CapacityThermometer({ inside, capacity }: { inside: number; capacity: number | null }) {
  if (!capacity || capacity <= 0) return <div className="text-xs text-[color:var(--muted)]">Capacity not set</div>;

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
        <div className={labelColor + ' font-semibold tracking-wide'}>{pct.toFixed(0)}% capacity</div>
        <div className="text-[color:var(--muted)]">
          {inside.toLocaleString()} / {capacity.toLocaleString()}
        </div>
      </div>
      <div className="w-full h-2 overflow-hidden border rounded bg-white/10 border-white/10">
        <div className={`h-full ${barColor} ${glowColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RecentTicker({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) return <div className="text-xs text-[color:var(--muted)]">No scans yet.</div>;

  return (
    <div className="text-xs font-mono leading-relaxed max-h-[180px] overflow-y-auto pr-1">
      {items.map((row, i) => {
        const t = new Date(row.ts);
        const hh = t.getHours().toString().padStart(2, '0');
        const mm = t.getMinutes().toString().padStart(2, '0');

        let actionColor = 'text-white';
        if (row.action === 'IN') actionColor = 'text-green-400';
        else if (row.action === 'OUT') actionColor = 'text-amber-400';
        else if (row.action === 'DENY') actionColor = 'text-red-400';

        const roleShort = row.role?.toUpperCase?.() || '';
        const station = row.station || '';

        return (
          <div key={i} className="flex flex-wrap gap-1 py-1 border-b border-white/10 last:border-0">
            <span className="text-white/40">
              {hh}:{mm}
            </span>
            <span className={actionColor + ' font-semibold'}>{row.action}</span>
            {station && <span className="text-white/60">{station}</span>}
            <span className="text-white/80 truncate max-w-[14rem] font-semibold">{row.name}</span>
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

/* ---------------------- Badge Studio Helpers ---------------------- */

const templateOptions: Array<{ id: BadgeTemplate; label: string }> = [
  { id: 'midnight_gold', label: 'Midnight Gold' },
  { id: 'pearl_white', label: 'Pearl White' },
  { id: 'obsidian', label: 'Obsidian' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'royal_blue', label: 'Royal Blue' },
  { id: 'sunrise', label: 'Sunrise' },
];

function isHex(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test((s || '').trim());
}
function isHttpsUrl(s: string) {
  try {
    const u = new URL((s || '').trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function AdminDashboardClient({
  slug,
  title,
  attendance,
  capacity,
  initialRegistrations,
  recentEvents,
  badgeConfig,
}: Props): JSX.Element {
  const [sessionExpired, setSessionExpired] = useState(false);

  const [rows, setRows] = useState<Registration[]>(initialRegistrations);
  const [q, setQ] = useState<string>('');
  const [onlyAttended, setOnlyAttended] = useState<boolean>(false);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState<boolean>(false);
  const [pending, setPending] = useState<boolean>(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const total = attendance?.total ?? rows.length;
  const checkedIn = rows.filter((r) => r.attended).length;
  const noShows = Math.max(0, total - checkedIn);

  // ✅ badge studio local state
  const [badge, setBadge] = useState<BadgeConfig>(() => badgeConfig || {});
  const [badgeSaving, setBadgeSaving] = useState(false);
  const [badgeMsg, setBadgeMsg] = useState<string | null>(null);

  useEffect(() => {
    setBadge(badgeConfig || {});
  }, [badgeConfig]);

  const filtered = useMemo<Registration[]>(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyAttended && !r.attended) return false;
      if (onlyCheckedIn && !r.scannedAt) return false;
      if (!query) return true;
      if (r.email.toLowerCase().includes(query)) return true;
      if (r.qrToken?.toLowerCase().includes(query)) return true;
      try {
        return (r.meta ? JSON.stringify(r.meta).toLowerCase() : '').includes(query);
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
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected[r.qrToken]);

  const toggleAllVisible = (v: boolean): void =>
    setSelected((prev) => {
      const n: Record<string, boolean> = { ...prev };
      filtered.forEach((r) => (n[r.qrToken] = v));
      return n;
    });

  const toggleOne = (t: string): void => setSelected((p) => ({ ...p, [t]: !p[t] }));

  function loginRedirectHref() {
    return `/login?next=${encodeURIComponent(`/admin/events/${slug}`)}`;
  }

  async function bulkPatch(body: { tokens?: string[]; attended?: boolean; checkedOut?: boolean }): Promise<void> {
    if (!someSelected) return;
    setPending(true);

    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration/bulk`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, station: 'Admin Bulk' }),
      });

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; rows?: Registration[]; error?: string }
        | null;

      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Bulk action failed');

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

  async function patchOne(token: string, next: { attended?: boolean; checkedOut?: boolean }): Promise<void> {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, station: 'Admin UI', ...next }),
      });

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; registration: Registration; error?: string }
        | null;

      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Action failed');

      const updated = json.registration;
      setRows((prev) => prev.map((r) => (r.qrToken === token ? { ...r, ...updated } : r)));
    } catch (e) {
      console.error('patchOne error', e);
    } finally {
      setPending(false);
    }
  }

  const importUrlBase = `/api/admin/events/${encodeURIComponent(slug)}/registration/import`;

  async function onCsvPicked(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setPending(true);

    try {
      const fd = new FormData();
      fd.set('file', file);

      const res = await fetch(importUrlBase, { method: 'POST', credentials: 'include', body: fd });

      if (res.status === 401) {
        setSessionExpired(true);
        setPending(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Import failed (${res.status})`);

      window.location.reload();
    } catch (err) {
      alert(((err as { message?: string } | null)?.message) || 'Import failed');
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

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
    const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

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
    a.download = `registrations-selected-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const spark = useMemo(() => {
    const base = Math.max(6, Math.min(24, Math.round(total / 2)));
    const arr = Array.from({ length: base }, (_, i) => Math.max(1, Math.round(((i + 1) * (checkedIn + 2)) / base)));
    return arr;
  }, [total, checkedIn]);

  // ✅ Badge Studio: use a real token for preview links if available
  const previewToken = rows[0]?.qrToken || null;

  function buildBadgeQuery(cfg: BadgeConfig) {
    const p = new URLSearchParams();
    if (cfg.template) p.set('template', cfg.template);
    if (cfg.bg) p.set('bg', cfg.bg);
    if (cfg.accent) p.set('accent', cfg.accent);
    if (cfg.logoUrl) p.set('logoUrl', cfg.logoUrl);
    if (cfg.sponsorLogoUrl) p.set('sponsorLogoUrl', cfg.sponsorLogoUrl);
    const s = p.toString();
    return s ? `&${s}` : '';
  }

  async function saveBadge(): Promise<void> {
    setBadgeMsg(null);
    setBadgeSaving(true);

    // minimal local validation (server validates too)
    const next: BadgeConfig = {};
    if (badge.template) next.template = badge.template;
    if (badge.bg) next.bg = badge.bg;
    if (badge.accent && isHex(badge.accent)) next.accent = badge.accent.trim();
    if (badge.logoUrl && isHttpsUrl(badge.logoUrl)) next.logoUrl = badge.logoUrl.trim();
    if (badge.sponsorLogoUrl && isHttpsUrl(badge.sponsorLogoUrl)) next.sponsorLogoUrl = badge.sponsorLogoUrl.trim();

    try {
      const res = await fetch('/api/admin/brand/badge', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'event', eventSlug: slug, badge: next }),
      });

      if (res.status === 401) {
        setSessionExpired(true);
        setBadgeSaving(false);
        return;
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; badge?: BadgeConfig } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Save failed (${res.status})`);

      setBadge(json.badge || next);
      setBadgeMsg('Saved. Your badges will render with this style.');
      // refresh server props (optional) — simplest is reload
      window.location.reload();
    } catch (e: any) {
      setBadgeMsg(e?.message ?? 'Save failed');
    } finally {
      setBadgeSaving(false);
      setTimeout(() => setBadgeMsg(null), 3500);
    }
  }

  if (sessionExpired) {
    return (
      <div className="max-w-xl p-6 mx-auto space-y-4 a-card">
        <div className="text-lg font-semibold">Session expired</div>
        <div className="text-sm text-[color:var(--muted)] mb-2">Your admin session is no longer valid. Please log in again.</div>
        <a href={loginRedirectHref()} className="block w-full text-center a-btn a-btn--primary">
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
            <div className="text-sm text-[color:var(--muted)]">Admin dashboard</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link className="a-btn a-btn--accent" href={`/admin/events/${encodeURIComponent(slug)}/stations`}>
              Manage Scanners
            </Link>
            <a className="a-btn a-btn--ghost" href="#badge-studio">
              Badge Studio
            </a>
            <Link href="/admin/events/new" className="a-btn a-btn--ghost">
              New Event
            </Link>
            <Link href="/scan" className="a-btn a-btn--strong">
              Open Scanner
            </Link>
          </div>
        </div>
      </div>

      {/* ✅ BADGE STUDIO */}
      <div id="badge-studio" className="p-4 a-card md:p-6 banana-sheen-hover">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold">Badge Studio</div>
            <div className="text-xs text-[color:var(--muted)] max-w-[70ch]">
              This sets the default badge style for this event. It applies to badge previews and PNG downloads.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {previewToken ? (
              <>
                <a
                  className="a-btn a-btn--ghost"
                  href={`/t/${encodeURIComponent(previewToken)}?view=badge`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview Badge
                </a>
                <a
                  className="a-btn"
                  href={`/api/ticket/png?token=${encodeURIComponent(previewToken)}&dpi=300${buildBadgeQuery(badge)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PNG
                </a>
              </>
            ) : (
              <span className="text-xs text-white/50">Create 1 registration to enable preview.</span>
            )}
          </div>
        </div>

        {badgeMsg && (
          <div className="mt-3 a-toast">
            <div className="text-sm font-semibold">Badge Studio</div>
            <div className="mt-1 text-sm text-white/75">{badgeMsg}</div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-2">
          <div>
            <label className="label">Template</label>
            <select
              className="input"
              value={badge.template || ''}
              onChange={(e) => setBadge((b) => ({ ...b, template: (e.target.value || undefined) as any }))}
            >
              <option value="">(default)</option>
              {templateOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Background</label>
            <select
              className="input"
              value={badge.bg || ''}
              onChange={(e) => setBadge((b) => ({ ...b, bg: (e.target.value || undefined) as any }))}
            >
              <option value="">(auto)</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div>
            <label className="label">Accent (hex)</label>
            <input
              className="input"
              value={badge.accent || ''}
              onChange={(e) => setBadge((b) => ({ ...b, accent: e.target.value }))}
              placeholder="#D4AF37"
            />
            <div className="mt-1 text-[11px] text-white/45">Use #RGB or #RRGGBB. Invalid values are ignored on save.</div>
          </div>

          <div>
            <label className="label">Logo URL (https)</label>
            <input
              className="input"
              value={badge.logoUrl || ''}
              onChange={(e) => setBadge((b) => ({ ...b, logoUrl: e.target.value }))}
              placeholder="https://…/logo.png"
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Sponsor Logo URL (https)</label>
            <input
              className="input"
              value={badge.sponsorLogoUrl || ''}
              onChange={(e) => setBadge((b) => ({ ...b, sponsorLogoUrl: e.target.value }))}
              placeholder="https://…/sponsor.png"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="a-btn a-btn--primary" onClick={() => void saveBadge()} disabled={badgeSaving}>
            {badgeSaving ? 'Saving…' : 'Save Badge Style'}
          </button>
          <button
            className="a-btn a-btn--ghost"
            onClick={() => setBadge(badgeConfig || {})}
            disabled={badgeSaving}
            title="Revert to current saved state"
          >
            Reset
          </button>
        </div>
      </div>

      {/* CSV BAR */}
      <div className="p-4 a-card md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">CSV In & Out</div>
            <div className="text-xs text-[color:var(--muted)] max-w-[60ch]">
              Import columns: <code>email</code> (required), <code>price</code>, <code>firstName</code>, <code>lastName</code>,{' '}
              <code>companyName</code>, <code>jobTitle</code>, …
            </div>
          </div>
          <a className="a-btn a-btn--ghost" href={`/admin/api/events/${encodeURIComponent(slug)}/export.csv`}>
            Export CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e): void => void onCsvPicked(e)}
            className="a-input-file"
          />
          <button className="a-btn" onClick={(): void => fileRef.current?.click()}>
            Choose File
          </button>
          <button
            className="a-btn a-btn--primary"
            onClick={(): void => {
              if (fileRef.current?.files?.[0]) void onCsvPicked({ currentTarget: fileRef.current } as any);
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
        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">TOTAL REGISTRATIONS</div>
          <CountUp value={total} />
        </div>

        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">CHECKED-IN</div>
          <CountUp value={checkedIn} />
        </div>

        <div className="p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)]">NO-SHOWS</div>
          <CountUp value={noShows} />
        </div>

        <div className="flex flex-col justify-between p-4 a-card banana-sheen-hover">
          <div className="text-xs text-[color:var(--muted)] mb-2">VENUE CAPACITY</div>
          <CapacityThermometer inside={checkedIn} capacity={capacity} />
        </div>
      </motion.div>

      {/* Chart + Action Center + Live Ticker */}
      <div className="a-bleed">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Check-ins (last 24h)</div>
              <div className="text-xs text-[color:var(--muted)]">live</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[color:var(--line)] bg-white">
              <AreaChart data={spark} />
            </div>
          </div>

          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="mb-2 text-sm font-medium">Action Center</div>

            <button
              className="w-full mb-2 a-btn a-btn--accent"
              disabled={!someSelected || pending}
              onClick={(): void => void bulkPatch({ tokens: selectedTokens, attended: true, checkedOut: false })}
            >
              Mark selected as Paid
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="w-full a-btn"
                disabled={!someSelected || pending}
                onClick={(): void => void bulkPatch({ tokens: selectedTokens, attended: true, checkedOut: false })}
              >
                Mark selected Attended
              </button>

              <button
                className="w-full a-btn a-btn--ghost"
                disabled={!someSelected || pending}
                onClick={(): void => void bulkPatch({ tokens: selectedTokens, attended: false })}
              >
                Remove from Attendance
              </button>
            </div>

            <button className="w-full mt-2 a-btn" disabled={!someSelected || pending} onClick={(): void => exportSelectedCsv()}>
              Export Selected (CSV)
            </button>
          </div>

          <div className="p-4 a-card banana-sheen-hover xl:col-span-1">
            <div className="mb-2 text-sm font-medium">Live Gate Activity</div>
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
            <input type="checkbox" checked={onlyAttended} onChange={(e) => setOnlyAttended(e.currentTarget.checked)} />
            Only attended
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyCheckedIn} onChange={(e) => setOnlyCheckedIn(e.currentTarget.checked)} />
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
                  <input type="checkbox" checked={allVisibleSelected} onChange={(e): void => toggleAllVisible(e.currentTarget.checked)} />
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
                      <input type="checkbox" checked={!!selected[r.qrToken]} onChange={(): void => toggleOne(r.qrToken)} />
                    </td>

                    <td className="a-td a-col-name">
                      <div className="font-medium cell-wrap">{fullName(r.meta) || '—'}</div>
                      {companyFromMeta(r.meta) && <div className="text-xs text-[color:var(--muted)] cell-wrap">{companyFromMeta(r.meta)}</div>}
                    </td>

                    <td className="a-td a-col-email">
                      <div className="font-mono cell-ellipsis">{r.email}</div>
                    </td>

                    <td className="a-td a-col-attended">{r.attended ? 'Yes' : 'No'}</td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">{new Date(r.registeredAt).toLocaleString()}</div>
                    </td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">{r.scannedAt ? new Date(r.scannedAt).toLocaleString() : '—'}</div>
                    </td>

                    <td className="a-td">
                      <div className="cell-ellipsis">{r.scannedBy || '—'}</div>
                    </td>

                    <td className="a-td a-col-datetime">
                      <div className="cell-ellipsis">{r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleString() : '—'}</div>
                    </td>

                    <td className="a-td a-col-actions">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="a-btn"
                          disabled={pending || r.attended}
                          onClick={(): void => void patchOne(r.qrToken, { attended: true, checkedOut: false })}
                        >
                          Mark Attended
                        </button>

                        <button
                          className="a-btn a-btn--ghost"
                          disabled={pending || !canRemove}
                          onClick={(): void => void patchOne(r.qrToken, { attended: false })}
                        >
                          Remove
                        </button>

                        <button
                          className="a-btn"
                          disabled={pending || !canCheckout}
                          onClick={(): void => void patchOne(r.qrToken, { checkedOut: true })}
                        >
                          Check-out
                        </button>

                        <a
                          className="a-btn a-btn--ghost whitespace-nowrap min-w-[7.5rem] text-center"
                          href={`/t/${encodeURIComponent(r.qrToken)}?view=badge`}
                          target="_blank"
                          rel="noreferrer"
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
