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
  if (!r.email || !/\S+@\S+\.\S+/.test(r.email)) errs.push('Invalid email');
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
          email: (r.email || '').trim().toLowerCase(),
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

  const validCount = useMemo(
    () => rows.filter((_, i) => !errors[i]?.length).length,
    [rows, errors]
  );

  async function commit() {
    setPending(true);
    setNotice(null);
    try {
      const payload = rows.filter((_, i) => !errors[i]?.length);
      const res = await fetch(`/admin/api/events/${encodeURIComponent(slug)}/registration/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? 'Import failed');
      setNotice(`✅ Imported ${json.created} new, updated ${json.updated}`);
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
        <p className="text-sm text-gray-600">Upload CSV with columns: email, firstName, lastName, jobTitle, companyName, …</p>
        <input type="file" accept=".csv,text/csv" className="mt-3" onChange={onFile} />
      </div>

      {rows.length > 0 && (
        <div className="p-4 overflow-auto a-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm">{validCount}/{rows.length} rows valid</div>
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
                {['#','email','firstName','lastName','jobTitle','companyName','status'].map(h => <th key={h} className="a-th">{h}</th>)}
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
                      {errs.length ? <span className="text-red-600">{errs.join(', ')}</span> : <span className="text-green-700">OK</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {notice && <div className="mt-3 text-sm">{notice}</div>}
        </div>
      )}
    </div>
  );
}
