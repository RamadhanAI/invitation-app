// components/AdminRegsTableClient.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';

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

function parseMeta(meta: unknown): Record<string, any> {
  if (!meta) return {};
  if (typeof meta === 'string') { try { return JSON.parse(meta); } catch { return {}; } }
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, any>;
  return {};
}
function fullName(meta: unknown): string {
  const m = parseMeta(meta);
  const c = [
    m.fullName, m.name,
    [m.firstName, m.lastName].filter(Boolean).join(' '),
    [m.firstname, m.lastname].filter(Boolean).join(' '),
    [m.givenName, m.familyName].filter(Boolean).join(' '),
  ].map(v => (v || '').toString().trim()).filter(Boolean);
  return c[0] || '';
}
function companyFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  return (m.companyName || m.company || m.org || '').toString().trim();
}

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

export default function AdminRegsTableClient({
  slug,
  registrations,
}: {
  slug: string;
  registrations: Registration[];
}) {
  const [rows, setRows] = useState<Registration[]>(registrations ?? []);
  const [q, setQ] = useState('');
  const [onlyAttended, setOnlyAttended] = useState(false);
  const [onlyCheckedIn, setOnlyCheckedIn] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];
    const query = q.toLowerCase().trim();
    return base.filter((r) => {
      if (onlyAttended && !r.attended) return false;
      if (onlyCheckedIn && !r.scannedAt) return false;
      if (!query) return true;
      if (r.email.toLowerCase().includes(query)) return true;
      if (r.qrToken?.toLowerCase().includes(query)) return true;
      try { return JSON.stringify(parseMeta(r.meta)).toLowerCase().includes(query); } catch { return false; }
    });
  }, [rows, q, onlyAttended, onlyCheckedIn]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected[r.qrToken]);
  const someVisibleSelected = filtered.some((r) => selected[r.qrToken]);

  function setAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      filtered.forEach((r) => (next[r.qrToken] = checked));
      return next;
    });
  }
  function toggleOne(token: string) {
    setSelected((prev) => ({ ...prev, [token]: !prev[token] }));
  }
  function updateRow(token: string, next: Partial<Registration>) {
    setRows((prev) => prev.map((r) => (r.qrToken === token ? { ...r, ...next } : r)));
  }

  // Admin APIs
  async function patchOne(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Action failed');
    return json.registration as Registration;
  }

  async function patchBulk(body: {
    emails?: string[];
    tokens?: string[];
    attended?: boolean;
    checkedOut?: boolean;
    station?: string;
  }) {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration/bulk`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Bulk action failed');
    return json as { count: number; rows: Registration[] };
  }

  function selectedRows(): Registration[] {
    return rows.filter((r) => selected[r.qrToken]);
  }

  function exportCsv(ofRows: Registration[]) {
    const header = [
      'name','company','email','attended',
      'registeredAt','scannedAt','scannedBy',
      'checkedOutAt','checkedOutBy','qrToken'
    ];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = ofRows.map((r) =>
      [
        fullName(r.meta) || '',
        companyFromMeta(r.meta) || '',
        r.email,
        r.attended ? 'Yes' : 'No',
        r.registeredAt,
        r.scannedAt ?? '',
        r.scannedBy ?? '',
        r.checkedOutAt ?? '',
        r.checkedOutBy ?? '',
        r.qrToken,
      ].map((x) => esc(String(x))).join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* toolbar */}
      <div className="a-bleed">
        <div className="flex flex-wrap items-center gap-2 p-3 a-card">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email, token…"
            className="max-w-md a-input"
          />
          <label className="flex items-center gap-2 text-sm select-none text-[color:var(--muted)]">
            <input type="checkbox" checked={onlyAttended} onChange={(e) => setOnlyAttended(e.currentTarget.checked)} />
            Only attended
          </label>
          <label className="flex items-center gap-2 text-sm select-none text-[color:var(--muted)]">
            <input type="checkbox" checked={onlyCheckedIn} onChange={(e) => setOnlyCheckedIn(e.currentTarget.checked)} />
            Only checked-in
          </label>
          <div className="text-xs text-[color:var(--muted)]">{filtered.length} of {rows.length}</div>
          <div className="flex-1" />
          <a
            className="a-btn"
            href={`/scan/${encodeURIComponent(slug)}/${encodeURIComponent('Scanner 1')}`}
            target="_blank"
            rel="noreferrer"
            title="Open Scanner"
          >
            Open Scanner
          </a>

          <button
            disabled={!filtered.some(r => selected[r.qrToken]) || pending}
            onClick={() =>
              start(async () => {
                const tokens = selectedRows().map((r) => r.qrToken);
                const { rows: updated } = await patchBulk({ tokens, attended: true, checkedOut: false, station: 'Bulk' });
                setRows((prev) => prev.map((r) => {
                  const u = updated.find((x) => x.qrToken === r.qrToken);
                  return u
                    ? { ...r, attended: u.attended, scannedAt: u.scannedAt, scannedBy: u.scannedBy ?? r.scannedBy, checkedOutAt: u.checkedOutAt, checkedOutBy: u.checkedOutBy }
                    : r;
                }));
              })
            }
            className="a-btn"
            title="Check-in selected"
          >
            Mark Attended (selected)
          </button>

          <button
            disabled={!filtered.some(r => selected[r.qrToken]) || pending}
            onClick={() =>
              start(async () => {
                const tokens = selectedRows().map((r) => r.qrToken);
                const { rows: updated } = await patchBulk({ tokens, attended: false, station: 'Bulk' });
                setRows((prev) => prev.map((r) => {
                  const u = updated.find((x) => x.qrToken === r.qrToken);
                  return u
                    ? { ...r, attended: u.attended, scannedAt: u.scannedAt, scannedBy: u.scannedBy ?? r.scannedBy, checkedOutAt: u.checkedOutAt, checkedOutBy: u.checkedOutBy }
                    : r;
                }));
              })
            }
            className="a-btn"
            title="Remove from attendance"
          >
            Remove from Attendance (selected)
          </button>

          <button
            disabled={!filtered.some(r => selected[r.qrToken]) || pending}
            onClick={() =>
              start(async () => {
                const tokens = selectedRows().map((r) => r.qrToken);
                const { rows: updated } = await patchBulk({ tokens, checkedOut: true, station: 'Bulk' });
                setRows((prev) => prev.map((r) => {
                  const u = updated.find((x) => x.qrToken === r.qrToken);
                  return u ? { ...r, checkedOutAt: u.checkedOutAt, checkedOutBy: u.checkedOutBy } : r;
                }));
              })
            }
            className="a-btn"
            title="Check-out selected"
          >
            Check-out (selected)
          </button>

          <button
            disabled={filtered.length === 0}
            onClick={() => exportCsv(filtered)}
            className="a-btn a-btn--ghost"
            title="Export current view to CSV"
          >
            Export Filtered CSV
          </button>
        </div>
      </div>

      {/* table — force horizontal scroll via min-width */}
      <div className="mt-3 a-bleed">
        <div className="a-table-wrap border border-[color:var(--line)] rounded-xl overflow-x-auto">
          <table className="w-full text-sm a-table text-white/90 table-fixed min-w-[1280px]">
            <colgroup>
              <col className="w-[2.5rem]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[26%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="a-th">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                    onChange={(e) => setAllVisible(e.currentTarget.checked)}
                  />
                </th>
                <th className="a-th whitespace-nowrap">Name / Company</th>
                <th className="a-th whitespace-nowrap">Email</th>
                <th className="a-th whitespace-nowrap">Attended</th>
                <th className="a-th whitespace-nowrap">Registered</th>
                <th className="a-th whitespace-nowrap">Scanned</th>
                <th className="a-th whitespace-nowrap">Scanned By</th>
                <th className="a-th whitespace-nowrap">Checked-out</th>
                <th className="text-right a-th whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.qrToken} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                  <td className="a-td">
                    <input type="checkbox" checked={!!selected[r.qrToken]} onChange={() => toggleOne(r.qrToken)} />
                  </td>
                  <td className="a-td">
                    <div className="font-medium truncate max-w-[24ch]">{fullName(r.meta) || '—'}</div>
                    {companyFromMeta(r.meta) && <div className="text-xs text-[color:var(--muted)] truncate max-w-[26ch]">{companyFromMeta(r.meta)}</div>}
                  </td>
                  <td className="font-mono a-td truncate max-w-[28ch]">{r.email}</td>
                  <td className="a-td whitespace-nowrap">{r.attended ? 'Yes' : 'No'}</td>
                  <td className="a-td whitespace-nowrap">{new Date(r.registeredAt).toLocaleString()}</td>
                  <td className="a-td whitespace-nowrap">{r.scannedAt ? new Date(r.scannedAt).toLocaleString() : '—'}</td>
                  <td className="a-td whitespace-nowrap">{r.scannedBy || '—'}</td>
                  <td className="a-td whitespace-nowrap">{r.checkedOutAt ? new Date(r.checkedOutAt).toLocaleString() : '—'}</td>
                  <td className="a-td">
                    <div className="flex justify-end gap-1 sm:flex-nowrap flex-wrap min-w-[22rem]">
                      {/* SINGLE persistent action: View Ticket */}
                      <a
                        href={`/t/${encodeURIComponent(r.qrToken)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 text-xs a-btn a-btn--ghost whitespace-nowrap"
                        title="View Ticket"
                      >
                        View Ticket
                      </a>

                      {!r.attended ? (
                        <button
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const u = await patchOne({ token: r.qrToken, attended: true, checkedOut: false, station: 'Admin UI' });
                              updateRow(r.qrToken, {
                                attended: u.attended,
                                scannedAt: u.scannedAt,
                                scannedBy: u.scannedBy ?? r.scannedBy,
                                checkedOutAt: u.checkedOutAt,
                                checkedOutBy: u.checkedOutBy,
                              });
                            })
                          }
                          className="px-2 py-1 text-xs a-btn"
                        >
                          Mark Attended
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const u = await patchOne({ token: r.qrToken, attended: false, station: 'Admin UI' });
                                updateRow(r.qrToken, {
                                  attended: u.attended,
                                  scannedAt: u.scannedAt,
                                  scannedBy: u.scannedBy ?? r.scannedBy,
                                  checkedOutAt: u.checkedOutAt,
                                  checkedOutBy: u.checkedOutBy,
                                });
                              })
                            }
                            className="px-2 py-1 text-xs a-btn a-btn--ghost"
                          >
                            Remove
                          </button>

                          <button
                            disabled={pending || !!r.checkedOutAt}
                            onClick={() =>
                              start(async () => {
                                const u = await patchOne({ token: r.qrToken, checkedOut: true, station: 'Admin UI' });
                                updateRow(r.qrToken, { checkedOutAt: u.checkedOutAt, checkedOutBy: u.checkedOutBy });
                              })
                            }
                            className="px-2 py-1 text-xs a-btn"
                          >
                            Check-out
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr><td className="a-td text-[color:var(--muted)]" colSpan={9}>No results.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
