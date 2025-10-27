// components/Admin/AdminStationsClient.tsx  (or wherever you keep it)
// components/Admin/AdminStationsClient.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';

type StationRow = {
  id: string;
  name: string;
  apiKeyMasked: string; // e.g. "code: S1 (inactive)"
  lastUsedAt: string | null;
  createdAt: string;
};

export default function AdminStationsClient({ slug }: { slug: string }) {
  const [rows, setRows] = useState<StationRow[]>([]);
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);

  // sessionExpired = true means: server said 401, cookie not valid anymore
  const [sessionExpired, setSessionExpired] = useState(false);

  const [pending, start] = useTransition();

  // --- helpers -------------------------------------------------------------

  function loginRedirectHref() {
    const nextUrl = `/admin/events/${encodeURIComponent(slug)}/stations`;
    return `/login?next=${encodeURIComponent(nextUrl)}`;
  }

  async function loadStations() {
    // GET /api/admin/events/[slug]/stations
    const res = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      }
    );

    if (res.status === 401) {
      // no valid inv_admin cookie
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      console.error('[stations:list]', j?.error || res.statusText);
      alert(j?.error || 'Failed to load stations');
      return;
    }

    // NOTE: new API returns { ok:true, items:[...] }
    setRows(j.items || []);
    setSessionExpired(false);
  }

  // create new scanner/station
  async function createOne(label: string) {
    // We send both name + code using the same label to satisfy the
    // new POST body { name, code } requirement.
    const res = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: label, code: label }),
      }
    );

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      alert(j.error || 'Failed to create scanner');
      return;
    }

    // new API returns { ok:true, station, secret: <plaintext> }
    setPlainKey(j.secret || null);
    await loadStations();
    setName('');
  }

  // rotate station secret
  async function rotate(id: string) {
    const res = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        // new API expects { rotate: true } instead of { rotateSecret: true }
        body: JSON.stringify({ rotate: true }),
      }
    );

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      alert(j.error || 'Failed to rotate key');
      return;
    }

    // PATCH returns { ok:true, station, secret?: <new plaintext> }
    setPlainKey(j.secret || null);
    await loadStations();
  }

  // soft-deactivate station
  async function remove(id: string) {
    if (!confirm('Deactivate this scanner?')) return;

    const res = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      alert(j.error || 'Failed to delete scanner');
      return;
    }

    await loadStations();
  }

  // initial load
  useEffect(() => {
    void loadStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // --- render --------------------------------------------------------------

  if (sessionExpired) {
    return (
      <div className="max-w-sm p-4 a-card a-error">
        <div className="mb-2 font-semibold">Session expired</div>
        <div className="mb-3 text-sm opacity-80">
          Your admin session is no longer valid. Please log in again.
        </div>
        <a
          href={loginRedirectHref()}
          className="w-full text-center a-btn a-btn--primary"
        >
          Log in
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Create / bulk create header */}
      <div className="flex flex-wrap gap-2">
        <input
          className="a-input"
          placeholder="Scanner name (e.g. Scanner 1 — Ahmed)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          className="a-btn a-btn--primary"
          disabled={!name || pending}
          onClick={() =>
            start(() => {
              void createOne(name);
            })
          }
        >
          Add scanner
        </button>

        <button
          className="a-btn"
          onClick={() =>
            start(async () => {
              const labels = [
                'Scanner 1',
                'Scanner 2',
                'Scanner 3',
                'Scanner 4',
                'Scanner 5',
              ];
              for (const l of labels) {
                await createOne(l);
              }
            })
          }
        >
          Create 5 quick
        </button>
      </div>

      {/* one-time reveal of a secret */}
      {plainKey && (
        <div className="p-3 border rounded-lg border-white/10 bg-white/5">
          <div className="mb-1 text-sm">
            New scanner key (copy now – shown only once):
          </div>
          <div className="font-mono break-all">{plainKey}</div>
          <div className="mt-1 text-xs opacity-70">
            Share this key with the person who will scan. They’ll open{' '}
            <code>/scan</code>, paste the key, and select the event.
          </div>
          <div className="mt-2">
            <button
              className="a-btn a-btn--accent"
              onClick={() => navigator.clipboard.writeText(plainKey)}
            >
              Copy
            </button>
            <button
              className="ml-2 a-btn a-btn--ghost"
              onClick={() => setPlainKey(null)}
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* table of scanners */}
      <table className="w-full a-table">
        <thead>
          <tr>
            <th className="a-th">Name</th>
            <th className="a-th">Key</th>
            <th className="a-th">Last used</th>
            <th className="a-th">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr className="a-tr" key={r.id}>
              <td className="a-td">{r.name}</td>
              <td className="font-mono a-td">{r.apiKeyMasked}</td>
              <td className="text-sm a-td">
                {r.lastUsedAt
                  ? new Date(r.lastUsedAt).toLocaleString()
                  : '—'}
              </td>
              <td className="a-td">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="a-btn"
                    onClick={() => rotate(r.id)}
                  >
                    Rotate key
                  </button>
                  <button
                    className="a-btn a-btn--ghost"
                    onClick={() => remove(r.id)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                className="text-sm a-td opacity-70"
                colSpan={4}
              >
                No scanners yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
