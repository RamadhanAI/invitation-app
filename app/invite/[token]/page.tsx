// app/invite/[token]/page.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function InvitePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const password = String(fd.get('password') ?? '').trim();
    const confirm = String(fd.get('confirm') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim();

    if (name.length > 0 && name.length < 2) {
      setErr('Name is too short.');
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password, ...(name ? { name } : {}) }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Invite failed');

      setOk(true);
      form.reset();
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="py-12 container-page">
      <div className="max-w-xl mx-auto">
        <div className="p-6 border shadow-2xl card border-white/10 bg-black/35 backdrop-blur md:p-8">
          <h1 className="text-2xl font-semibold text-white">Activate your admin access</h1>
          <p className="mt-2 text-sm text-white/70">
            Set a password for your tenant admin account. If your tenant is still pending approval,
            you’ll be able to sign in as soon as it’s activated.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Your name (optional)</label>
              <input
                name="name"
                className="input"
                placeholder="e.g., Aisha Mohammed"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="label">New password</label>
              <input
                name="password"
                type="password"
                required
                className="input"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="label">Confirm password</label>
              <input
                name="confirm"
                type="password"
                required
                className="input"
                autoComplete="new-password"
              />
            </div>

            {err ? (
              <div className="p-3 text-sm text-red-200 border rounded-2xl border-red-400/20 bg-red-500/10">
                {err}
              </div>
            ) : null}

            {ok ? (
              <div className="p-3 text-sm border rounded-2xl border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                Password set ✅ You can now{' '}
                <Link href="/login" className="underline underline-offset-4">
                  login
                </Link>
                .
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 font-semibold btn btn-primary rounded-2xl"
            >
              {loading ? 'Saving…' : 'Save password'}
            </button>

            <div className="text-xs text-white/50">
              Trouble? Ask the platform owner to resend your invite.
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
