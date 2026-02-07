'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';

type Row = {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  [k: string]: any;
};

function validateRow(r: Row): string[] {
  const errs: string[] = [];
  const email = String(r.email || '').trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) errs.push('Invalid email');
  return errs;
}

export default function ImportPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setNotice(null);

    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data || []).map((r) => ({
          ...r,
          email: String(r.email || '').trim().toLowerCase(),
        }));

        const errMap: Record<number, string[]> = {};
        data.forEach((r, i) => {
          const errs = validateRow(r);
          if (errs.length) errMap[i] = errs;
        });

        setErrors(errMap);
        setRows(data);
      },
      error: (err) => {
        setRows([]);
        setErrors({});
        setNotice(`CSV parse error: ${err.message}`);
      },
    });
  }

  const validRows = useMemo(() => rows.filter((_, i) => !errors[i]?.length), [rows, errors]);
  const validCount = validRows.length;

  async function commit() {
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}/registration/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRows), // ✅ route supports array JSON
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Import failed');

      // your patched import route returns { summary: { created, updated, ... } }
      const s = json.summary || {};
      setNotice(`✅ Imported: created ${s.created ?? 0}, updated ${s.updated ?? 0}, parsed ${s.parsed ?? validCount}`);
    } catch (e: any) {
      setNotice(`❌ ${e?.message || 'Import failed'}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 a-card">
        <h1 className="text-xl font-semibold">Bulk Import</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Upload CSV with columns: email, firstName, lastName, jobTitle, companyName, …
        </p>
        <input type="file" accept=".csv,text/csv" className="mt-3" onChange={onFile} />
      </div>

      {rows.length > 0 && (
        <div className="p-4 overflow-auto a-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-white/80">
              {validCount}/{rows.length} rows valid
            </div>
            <button
              className="a-btn a-btn--primary disabled:opacity-50"
              onClick={commit}
              disabled={pending || validCount === 0}
            >
              {pending ? 'Importing…' : 'Import valid rows'}
            </button>
          </div>

          <table className="w-full text-sm a-table">
            <thead>
              <tr>
                {['#','email','firstName','lastName','jobTitle','companyName','status'].map(h => (
                  <th key={h} className="a-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const errs = errors[i] || [];
                return (
                  <tr key={i} className="a-tr">
                    <td className="a-td">{i + 1}</td>
                    <td className="a-td">{r.email}</td>
                    <td className="a-td">{r.firstName || '—'}</td>
                    <td className="a-td">{r.lastName || '—'}</td>
                    <td className="a-td">{r.jobTitle || '—'}</td>
                    <td className="a-td">{r.companyName || '—'}</td>
                    <td className="a-td">
                      {errs.length
                        ? <span className="text-red-400">{errs.join(', ')}</span>
                        : <span className="text-emerald-300">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {notice && <div className="mt-3 text-sm text-white/80">{notice}</div>}
        </div>
      )}
    </div>
  );
}
