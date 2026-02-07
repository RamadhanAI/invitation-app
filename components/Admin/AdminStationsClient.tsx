// components/Admin/AdminStationsClient.tsx  (or wherever you keep it)
// components/Admin/AdminStationsClient.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';

type StationRow = {
  id: string;
  name: string;
  apiKeyMasked: string;
  lastUsedAt: string | null;
  createdAt: string;
};

function setupLink(slug: string, codeMasked: string, secretPlain: string) {
  // codeMasked looks like "code: S2" or "code: S2 (inactive)"
  const m = /code:\s*([A-Za-z0-9_-]+)/.exec(codeMasked);
  const code = (m?.[1] || '').trim();
  const u = new URL('/scan', window.location.origin);
  u.searchParams.set('slug', slug);
  u.searchParams.set('code', code);
  u.searchParams.set('secret', secretPlain);
  u.searchParams.set('auto', '1');
  return u.toString();
}

export default function AdminStationsClient({ slug }: { slug: string }) {
  const [rows, setRows] = useState<StationRow[]>([]);
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [plainMaskedCode, setPlainMaskedCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  function loginRedirectHref() {
    return `/login?next=${encodeURIComponent(`/admin/events/${slug}/stations`)}`;
  }

  async function loadStations() {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/stations`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (res.status === 401) {
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      console.error('[stations:list]', j?.error || res.statusText);
      alert(j?.error || 'Failed to load scanners');
      setLoading(false);
      return;
    }

    setRows(j.items || []);
    setLoading(false);
  }

  async function createOne(label: string) {
    const clean = (label || '').trim();
    if (!clean) return;

    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/stations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: clean }),
    });

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      alert(j?.error || 'Failed to create scanner');
      return;
    }

    setPlainKey(j.secret || null);
    setPlainMaskedCode(j?.station?.apiKeyMasked || null);
    setName('');
    await loadStations();
  }

  async function rotate(id: string) {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rotate: true }),
    });

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      alert(j?.error || 'Failed to rotate key');
      return;
    }

    setPlainKey(j.secret || null);
    setPlainMaskedCode(j?.station?.apiKeyMasked || null);
    await loadStations();
  }

  async function remove(id: string) {
    if (!confirm('Delete this scanner? This cannot be undone.')) return;

    const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/stations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (res.status === 401) {
      setSessionExpired(true);
      return;
    }

    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) {
      alert(j?.error || 'Failed to delete scanner');
      return;
    }

    await loadStations();
  }

  useEffect(() => {
    void loadStations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (sessionExpired) {
    return (
      <div className="max-w-sm p-4 a-card a-error">
        <div className="mb-2 font-semibold">Session expired</div>
        <div className="mb-4 text-sm opacity-80">Please log in again.</div>
        <a className="block w-full text-center a-btn a-btn--primary" href={loginRedirectHref()}>
          Log in
        </a>
      </div>
    );
  }

  if (loading) {
    return <div className="p-4 a-card a-muted">Loading scanners…</div>;
  }

  const canShowSetup = !!plainKey && !!plainMaskedCode;
  const link = canShowSetup ? setupLink(slug, plainMaskedCode!, plainKey!) : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="a-input"
          placeholder="Scanner name (e.g. Entrance Gate 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const clean = name.trim();
              if (!clean || pending) return;
              start(() => void createOne(clean));
            }
          }}
        />

        <button
          type="button"
          className="a-btn a-btn--primary"
          disabled={!name.trim() || pending}
          onClick={() => start(() => void createOne(name.trim()))}
        >
          Add scanner
        </button>

        <button
          type="button"
          className="a-btn"
          onClick={() =>
            start(() =>
              (async () => {
                const labels = ['Scanner 1', 'Scanner 2', 'Scanner 3'];
                for (const l of labels) await createOne(l);
              })()
            )
          }
        >
          Quick 3
        </button>
      </div>

      {canShowSetup && (
        <div className="p-3 border rounded-2xl border-white/10 bg-white/5">
          <div className="mb-1 text-sm font-medium">Scanner setup (no typing)</div>

          <div className="text-xs opacity-70">One-time secret (copy now):</div>
          <div className="font-mono break-all">{plainKey}</div>

          <div className="mt-3 text-xs opacity-70">Setup link (open on the scanning phone):</div>
          <div className="font-mono break-all">{link}</div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="a-btn a-btn--accent"
              onClick={() => navigator.clipboard.writeText(plainKey!)}
            >
              Copy Secret
            </button>
            <button
              type="button"
              className="a-btn a-btn--accent"
              onClick={() => navigator.clipboard.writeText(link)}
            >
              Copy Setup Link
            </button>
            <a className="a-btn a-btn--ghost" href={link} target="_blank" rel="noreferrer">
              Open Setup Link
            </a>
            <button
              type="button"
              className="a-btn a-btn--ghost"
              onClick={() => {
                setPlainKey(null);
                setPlainMaskedCode(null);
              }}
            >
              Hide
            </button>
          </div>

          <div className="mt-2 text-[11px] opacity-60">
            Tip: Send the setup link to staff on WhatsApp. They open it and they’re armed instantly.
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="a-btn" onClick={() => rotate(r.id)}>
                    Rotate key
                  </button>
                  <button type="button" className="a-btn a-btn--ghost" onClick={() => remove(r.id)}>
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
