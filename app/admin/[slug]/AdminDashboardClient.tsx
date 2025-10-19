'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';

type Attendance = { total: number; attended: number; noShows: number };
type Registration = {
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

const PUBLIC_ADMIN_KEY: string = (process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
const ADMIN_AUTH_HEADER: Record<string, string> = PUBLIC_ADMIN_KEY ? { 'x-api-key': PUBLIC_ADMIN_KEY } : {};
const ADMIN_AUTH_QS: string = PUBLIC_ADMIN_KEY ? `?key=${encodeURIComponent(PUBLIC_ADMIN_KEY)}` : '';

function parseMeta(meta: unknown): Record<string, unknown> {
  if (!meta) return {};
  if (typeof meta === 'string') { try { return JSON.parse(meta) as Record<string, unknown>; } catch { return {}; } }
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return {};
}
function fullName(meta: unknown): string {
  const m = parseMeta(meta);
  const cands = [
    m['fullName'], m['name'],
    [m['firstName'], m['lastName']].filter(Boolean).join(' '),
    [m['firstname'], m['lastname']].filter(Boolean).join(' '),
    [m['givenName'], m['familyName']].filter(Boolean).join(' '),
  ].map((v) => (v || '').toString().trim()).filter(Boolean);
  return cands[0] || '';
}
function companyFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  return (m['companyName'] || m['company'] || m['org'] || '').toString().trim();
}

async function ensureAdminSession(explicitKey?: string): Promise<boolean> {
  const key = (explicitKey || PUBLIC_ADMIN_KEY || '').trim();
  if (!key) return false;
  try {
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!j?.ok;
  } catch {
    return false;
  }
}

function CountUp({ value }: { value: number }): JSX.Element {
  const mv = useMotionValue(0);
  const fmt = useTransform(mv, (v: number) => Math.round(v).toLocaleString());
  const [text, setText] = useState<string>('0');
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    const off = fmt.on('change', (v) => setText(v));
    return () => { c.stop(); off(); };
  }, [value]);
  return <span className="kpi__value">{text}</span>;
}

export default function AdminDashboardClient({
  slug, title, attendance, initialRegistrations,
}: {
  slug: string; title: string; attendance: Attendance; initialRegistrations: Registration[];
}): JSX.Element {
  const [rows, setRows] = useState<Registration[]>(initialRegistrations);
  const [q, setQ] = useState<string>('');
  const [onlyAttended, setOnlyAttended] = useState<boolean>(false);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState<boolean>(false);
  const [pending, setPending] = useState<boolean>(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo<Registration[]>(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyAttended && !r.attended) return false;
      if (onlyCheckedIn && !r.scannedAt) return false;
      if (!query) return true;
      if (r.email.toLowerCase().includes(query)) return true;
      if (r.qrToken?.toLowerCase().includes(query)) return true;
      try { return (r.meta ? JSON.stringify(r.meta).toLowerCase() : '').includes(query); } catch { return false; }
    });
  }, [rows, q, onlyAttended, onlyCheckedIn]);

  const total = attendance?.total ?? rows.length;
  const checkedIn = rows.filter((r) => r.attended).length;
  const noShows = Math.max(0, total - checkedIn);

  const selectedTokens = useMemo<string[]>(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );
  const someSelected: boolean = selectedTokens.length > 0;
  const allVisibleSelected: boolean = filtered.length > 0 && filtered.every((r) => selected[r.qrToken]);

  const toggleAllVisible = (v: boolean): void =>
    setSelected((prev) => { const n: Record<string, boolean> = { ...prev }; filtered.forEach((r) => (n[r.qrToken] = v)); return n; });

  const toggleOne = (t: string): void =>
    setSelected((p) => ({ ...p, [t]: !p[t] }));

  const bulkPatch: (body: { tokens?: string[]; attended?: boolean; checkedOut?: boolean }) => Promise<void> = async (body) => {
    const attempt = async (): Promise<void> => {
      if (!someSelected) return;
      setPending(true);
      try {
        const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...ADMIN_AUTH_HEADER },
          body: JSON.stringify({ ...body, station: 'Admin Bulk' }),
        });
        if (res.status === 401 && (await ensureAdminSession())) {
          await attempt();
          return;
        }
        const json = (await res.json().catch(() => null)) as { ok?: boolean; rows?: Registration[]; error?: string } | null;
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
    };
    await attempt();
  };

  async function patchOne(
    token: string,
    next: Partial<Pick<Registration, 'attended'>> & { checkedOut?: boolean }
  ): Promise<void> {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...ADMIN_AUTH_HEADER },
        body: JSON.stringify({ token, station: 'Admin UI', ...next }),
      });
      if (res.status === 401 && (await ensureAdminSession())) { await patchOne(token, next); return; }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; registration: Registration; error?: string } | null;
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
  const importUrl = PUBLIC_ADMIN_KEY ? `${importUrlBase}${ADMIN_AUTH_QS}` : importUrlBase;

  const onCsvPicked = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setPending(true);
    try {
      const fd = new FormData(); fd.set('file', file);
      let res = await fetch(importUrl, { method: 'POST', body: fd });
      if (res.status === 401 && (await ensureAdminSession())) {
        res = await fetch(importUrlBase, { method: 'POST', body: fd });
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Import failed (${res.status})`);
      window.location.reload();
    } catch (err) {
      alert((err as { message?: string } | null)?.message || 'Import failed');
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  function exportSelectedCsv(): void {
    if (!someSelected) return;
    const sel = rows.filter((r) => selected[r.qrToken]);
    const header = ['name','company','email','attended','registeredAt','scannedAt','scannedBy','checkedOutAt','checkedOutBy','qrToken'];
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
      ].map((x) => esc(String(x))).join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url;
    a.download = `registrations-selected-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="p-4 a-card md:p-6 banana-sheen-hover">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{title}</div>
            <div className="text-sm text-[color:var(--muted)]">Admin dashboard</div>
          </div>
          <Link className="a-btn a-btn--accent" href={`/admin/events/${encodeURIComponent(slug)}/stations`}>
            Manage Scanners
          </Link>
        </div>
      </div>

      <motion.div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="kpi banana-sheen-hover"><div className="kpi__title">Total registrations</div><CountUp value={total} /></div>
        <div className="kpi banana-sheen-hover"><div className="kpi__title">Checked-in</div><CountUp value={checkedIn} /></div>
        <div className="kpi banana-sheen-hover"><div className="kpi__title">No-shows</div><CountUp value={noShows} /></div>
      </motion.div>

      <div className="a-bleed">
        <div className="overflow-auto a-card banana-sheen-hover a-table-wrap">
          <table className="w-full a-table a-table--dense a-table--tight a-table--wide">
            <thead>
              <tr>
                <th className="a-th">
                  <input type="checkbox" checked={allVisibleSelected} onChange={(e): void => toggleAllVisible(e.currentTarget.checked)} />
                </th>
                <th className="a-th">Name / Company</th>
                <th className="a-th">Email</th>
                <th className="a-th">Attended</th>
                <th className="a-th">Registered</th>
                <th className="a-th">Scanned</th>
                <th className="a-th">Scanned By</th>
                <th className="a-th">Checked-out</th>
                <th className="a-th a-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td className="text-gray-500 a-td" colSpan={9}>No results.</td></tr>
              )}
              {filtered.map((r) => {
                const canRemove = r.attended;
                const canCheckout = r.attended && !r.checkedOutAt;
                return (
                  <tr key={r.qrToken}>
                    <td className="a-td">
                      <input type="checkbox" checked={!!selected[r.qrToken]} onChange={(): void => toggleOne(r.qrToken)} />
                    </td>
                    <td className="a-td">
                      <div className="font-medium cell-wrap">{fullName(r.meta) || '—'}</div>
                      {companyFromMeta(r.meta) && <div className="text-xs text-white/60 cell-wrap">{companyFromMeta(r.meta)}</div>}
                    </td>
                    <td className="a-td"><div className="font-mono cell-ellipsis">{r.email}</div></td>
                    <td className="a-td">{r.attended ? 'Yes' : 'No'}</td>
                    <td className="a-td"><div className="cell-ellipsis">{new Date(r.registeredAt).toLocaleString()}</div></td>
                    <td className="a-td"><div className="cell-ellipsis">{r.scannedAt ? new Date(r.scannedAt).toLocaleString() : '—'}</div></td>
                    <td className="a-td"><div className="cell-ellipsis">{r.scannedBy || '—'}</div></td>
                    <td className="a-td"><div className="cell-ellipsis">{r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleString() : '—'}</div></td>
                    <td className="a-td a-col-actions">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button className="a-btn" disabled={pending || r.attended}
                          onClick={(): void => { void patchOne(r.qrToken, { attended: true, checkedOut: false }); }}
                          title={r.attended ? 'Already attended' : 'Mark Attended'}>
                          Mark Attended
                        </button>

                        <button className="a-btn a-btn--ghost" disabled={pending || !canRemove}
                          onClick={(): void => { void patchOne(r.qrToken, { attended: false }); }}
                          title={!canRemove ? 'Not attended yet' : 'Remove from Attendance'}>
                          Remove from Attendance
                        </button>

                        <button className="a-btn" disabled={pending || !canCheckout}
                          onClick={(): void => { void patchOne(r.qrToken, { checkedOut: true }); }}
                          title={!canCheckout ? 'Must be attended and not already checked out' : 'Check-out'}>
                          Check-out
                        </button>

                        <a className="a-btn a-btn--ghost whitespace-nowrap min-w-[7.5rem] text-center"
                           href={`/t/${encodeURIComponent(r.qrToken)}?view=badge`}
                           target="_blank" rel="noreferrer" title="View ticket (badge)">
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

        <div className="flex items-center gap-3 mt-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e): void => { void onCsvPicked(e); }}
            className="a-input-file"
          />
          <button className="a-btn a-btn--ghost" disabled={!someSelected || pending}
            onClick={(): void => exportSelectedCsv()}>
            Export Selected CSV
          </button>
          <button className="a-btn" disabled={!someSelected || pending}
            onClick={(): void => { void bulkPatch({ tokens: selectedTokens, attended: true, checkedOut: false }); }}>
            Mark Selected Attended
          </button>
          <button className="a-btn a-btn--ghost" disabled={!someSelected || pending}
            onClick={(): void => { void bulkPatch({ tokens: selectedTokens, attended: false }); }}>
            Remove Selected Attendance
          </button>
          <button className="a-btn" disabled={!someSelected || pending}
            onClick={(): void => { void bulkPatch({ tokens: selectedTokens, checkedOut: true }); }}>
            Check-out Selected
          </button>
        </div>
      </div>
    </div>
  );
}
