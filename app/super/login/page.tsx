// app/super/login/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function SuperLoginPage({ searchParams }: { searchParams: { next?: string; err?: string } }) {
  const next = searchParams?.next || '/admin/tenants';
  const err = searchParams?.err === '1';

  return (
    <div className="container-page">
      <section className="max-w-md p-6 mx-auto mt-10 glass rounded-2xl">
        <h1 className="text-2xl font-semibold">Super Admin Login</h1>
        <p className="mt-2 text-sm text-white/70">Platform owner access (tenants, staff, platform settings).</p>

        {err ? <div className="mt-3 text-sm text-rose-300">Invalid credentials</div> : null}

        {/* IMPORTANT: use the canonical login handler */}
        <form method="post" action="/api/auth/login" className="grid gap-3 mt-5">
          <input type="hidden" name="next" value={next} />

          <label className="grid gap-1">
            <span className="text-sm text-white/80">Username</span>
            <input name="identifier" className="p-2 border rounded bg-white/10 border-white/10" />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/80">Password</span>
            <input type="password" name="password" className="p-2 border rounded bg-white/10 border-white/10" />
          </label>

          <button className="a-btn a-btn--primary" type="submit">
            Enter Control Plane
          </button>

          <a className="mt-2 text-xs underline text-white/60" href={`/login?next=${encodeURIComponent('/admin')}`}>
            Tenant login instead
          </a>
        </form>
      </section>
    </div>
  );
}
