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

export default function AdminStationsClient({
  slug,
}: {
  slug: string;
}) {
  const [rows, setRows] = useState<StationRow[]>([]);
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [authChecked, setAuthChecked] = useState(false); // block UI until session check done

  // 1. verify admin cookie session
  async function ensureSession() {
    const res = await fetch('/api/admin/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (res.status === 401) {
      // not logged in -> bounce to /login with return
      const nextUrl = `/admin/events/${encodeURIComponent(
        slug
      )}/stations`;
      window.location.href = `/login?next=${encodeURIComponent(
        nextUrl
      )}`;
      return false;
    }
    return true;
  }

  // 2. load stations list
  async function load() {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(
        slug
      )}/stations`,
      {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      setRows(j.stations);
    } else {
      console.error('[stations:list]', j?.error || r.statusText);
      alert(j?.error || 'Failed to load stations');
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await ensureSession();
      if (ok) {
        await load();
        setAuthChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // create new station
  async function createOne(label: string) {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(
        slug
      )}/stations`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: label }),
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      setPlainKey(j.secret || null); // show the one-time secret for this station
      await load();
      setName('');
    } else {
      alert(j.error || 'Failed to create scanner');
    }
  }

  // rotate station secret
  async function rotate(id: string) {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(
        slug
      )}/stations/${id}`,
      {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ rotateSecret: true }),
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      setPlainKey(j.secret || null);
      await load();
    } else {
      alert(j.error || 'Failed to rotate key');
    }
  }

  // delete (soft deactivate)
  async function remove(id: string) {
    if (!confirm('Deactivate this scanner?')) return;
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(
        slug
      )}/stations/${id}`,
      {
        method: 'DELETE',
        credentials: 'same-origin',
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      await load();
    } else {
      alert(j.error || 'Failed to delete scanner');
    }
  }

  if (!authChecked) {
    return (
      <div className="p-4 a-card a-muted">
        Checking admin session…
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
            start(() =>
              (async () => {
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
              })()
            )
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
            Share this key with the person who will scan. They’ll
            open <code>/scan</code>, paste the key, and select the
            event.
          </div>
          <div className="mt-2">
            <button
              className="a-btn a-btn--accent"
              onClick={() =>
                navigator.clipboard.writeText(plainKey)
              }
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

      {/* table */}
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
              <td className="font-mono a-td">
                {r.apiKeyMasked}
              </td>
              <td className="text-sm a-td">
                {r.lastUsedAt
                  ? new Date(
                      r.lastUsedAt
                    ).toLocaleString()
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
