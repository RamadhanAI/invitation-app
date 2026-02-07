// app/request-demo/page.tsx
// app/request-demo/page.tsx
'use client';

import { useState } from 'react';

export default function RequestDemoPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const inputClass = 'input';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = e.currentTarget;
    const fd = new FormData(form);

    setSubmitting(true);
    setError(null);
    setOk(false);

    try {
      const res = await fetch('/api/demo-request', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error || 'Could not submit request');

      setOk(true);
      form.reset();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="w-full max-w-5xl px-4 mx-auto py-14" suppressHydrationWarning>
      <div
        className="p-6 border shadow-2xl rounded-3xl border-white/10 bg-black/35 backdrop-blur md:p-10"
        suppressHydrationWarning
      >
        <h1 className="text-3xl font-semibold text-white">Request a demo</h1>
        <p className="max-w-2xl mt-2 text-white/70">
          Tell us a bit about your company and your available time slots — we’ll confirm a time and set you up.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Full name *</label>
              <input name="name" required className={inputClass} placeholder="Your name" />
            </div>

            <div>
              <label className="label">Work email *</label>
              <input name="email" type="email" required className={inputClass} placeholder="you@company.com" />
            </div>

            <div>
              <label className="label">Company *</label>
              <input name="company" required className={inputClass} placeholder="Company name" />
            </div>

            <div>
              <label className="label">Role</label>
              <input name="role" className={inputClass} placeholder="e.g., Operations Manager" />
            </div>

            <div>
              <label className="label">Phone</label>
              <input name="phone" className={inputClass} placeholder="+971..." />
            </div>

            <div>
              <label className="label">Timezone</label>
              <input name="timezone" className={inputClass} placeholder="e.g., Asia/Dubai" />
            </div>
          </div>

          <div>
            <label className="label">Availability *</label>
            <textarea
              name="availability"
              required
              rows={4}
              className={inputClass}
              placeholder="Example: Mon–Wed 10am–2pm (Asia/Dubai), or Fri 4pm–6pm..."
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea name="notes" rows={4} className={inputClass} placeholder="Anything we should know?" />
          </div>

          {error ? (
            <div className="p-3 text-sm text-red-200 border rounded-xl border-red-400/20 bg-red-500/10">{error}</div>
          ) : null}

          {ok ? (
            <div className="p-3 text-sm border rounded-xl border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
              Submitted! We’ll reach out shortly.
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className={[
              'w-full rounded-xl px-4 py-3 font-semibold',
              'bg-gradient-to-r from-amber-400 to-fuchsia-500 text-black',
              'shadow-lg shadow-amber-500/10',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </div>
    </main>
  );
}
