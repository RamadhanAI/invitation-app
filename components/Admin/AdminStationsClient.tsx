// components/Admin/AdminStationsClient.tsx  (or wherever you keep it)
// components/Admin/AdminStationsClient.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';

const ADMIN_KEY =
  process.env.NEXT_PUBLIC_ADMIN_KEY || process.env.ADMIN_KEY || '';

type StationRow = {
  id: string;
  name: string;
  apiKeyMasked: string;       // server returns "code: S#"
  lastUsedAt: string | null;  // server returns null (ok)
  createdAt: string;          // serialized ISO from NextResponse.json
};

// pick 'apiKey' (old) or 'secret' (current API) from responses
const pickPlain = (j: any): string | null => j?.apiKey ?? j?.secret ?? null;

export default function AdminStationsClient({ slug }: { slug: string }) {
  const [rows, setRows] = useState<StationRow[]>([]);
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function load() {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations`,
      {
        headers: ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {},
        cache: 'no-store',
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) setRows(j.stations);
    else console.error('[stations:list] ', j?.error || r.statusText);
  }

  useEffect(() => {
    void load();
  }, [slug]);

  async function createOne(label: string) {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {}),
        },
        body: JSON.stringify({ name: label }),
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      setPlainKey(pickPlain(j)); // ← secret/apiKey compatible
      await load();
    } else {
      alert(j.error || 'Failed to create scanner');
    }
  }

  async function rotate(id: string) {
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {}),
        },
        body: JSON.stringify({ rotateSecret: true }), // ← matches your API
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) {
      setPlainKey(pickPlain(j)); // ← returns { secret }
      await load();
    } else {
      alert(j.error || 'Failed to rotate key');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete scanner?')) return;
    const r = await fetch(
      `/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`,
      {
        method: 'DELETE',
        headers: ADMIN_KEY ? { 'x-api-key': ADMIN_KEY } : {},
      }
    );
    const j = await r.json();
    if (r.ok && j.ok) await load();
    else alert(j.error || 'Failed to delete scanner');
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="a-input"
          placeholder="Scanner name (e.g. Scanner 1 — Ahmed)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="a-btn a-btn--primary"
          disabled={!name || pending}
          onClick={() => start(() => void createOne(name))}
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
                for (const l of labels) await createOne(l);
              })()
            )
          }
        >
          Create 5 quick
        </button>
      </div>

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
                {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : '—'}
              </td>
              <td className="a-td">
                <div className="flex gap-2">
                  <button className="a-btn" onClick={() => rotate(r.id)}>
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
              <td className="text-sm a-td opacity-70" colSpan={4}>
                No scanners yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
