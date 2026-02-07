// app/(auth)/scanner-login/page.tsx
// app/(auth)/scanner-login/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ScannerLoginPage({ searchParams }: { searchParams?: { next?: string; err?: string } }) {
  const next = searchParams?.next || '/scan';
  const err = searchParams?.err;

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <form method="POST" action="/api/auth/scanner-login" className="w-full max-w-md p-6 space-y-4 a-card md:p-8">
        <h1 className="text-xl font-semibold">Scanner sign in</h1>
        <p className="text-sm text-white/70">
          Use a <b>Station code & secret</b> + <b>Event slug</b>. (Scanner keys can be added later.)
        </p>

        {err === 'station' && <div className="text-sm text-red-400">Invalid station credentials or event slug.</div>}
        {err === 'env' && <div className="text-sm text-red-400">Invalid scanner key.</div>}
        {err === 'missing' && (
          <div className="text-sm text-yellow-400">Enter Event slug + Station code + secret.</div>
        )}

        <input type="hidden" name="next" value={next} />

        <div className="form-section">
          <div className="form-section__head">Station</div>
          <div className="p-3 space-y-3">
            <label className="block">
              <div className="label">Event slug</div>
              <input name="eventSlug" className="w-full input" placeholder="e.g. prime-expo-2025" />
            </label>

            <label className="block">
              <div className="label">Station code</div>
              <input name="code" className="w-full input" placeholder="e.g. VIP" />
            </label>

            <label className="block">
              <div className="label">Station secret</div>
              <input name="secret" className="w-full input" placeholder="••••••" type="password" />
            </label>
          </div>
        </div>

        <button className="w-full btn btn-primary">Sign in</button>
      </form>
    </div>
  );
}
