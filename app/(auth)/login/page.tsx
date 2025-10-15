// app/(auth)/login/page.tsx
// app/(auth)/login/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams?: { next?: string; err?: string } }) {
  const next = searchParams?.next || '/admin';
  const err  = searchParams?.err;
  
  const goldDeep = '#B8860B';
  const goldLux  = '#D4AF37';
  const goldGlow = '0 20px 40px rgba(212, 175, 55, .18)';

  return (
    <div
      className="relative flex items-center justify-center min-h-screen p-6"
      style={{
        background:
          'radial-gradient(1200px 800px at 20% -10%, #0e121a 0%, #0b0d10 60%), ' +
          'radial-gradient(900px 600px at 110% 0%, rgba(184,134,11,.08) 0%, transparent 52%), #0b0d10',
      }}
    >
      <div className="absolute inset-0 pointer-events-none"
           style={{ boxShadow: 'inset 0 0 180px rgba(0,0,0,.6)' }} />

      {/* NOTE: classic POST to our route handler */}
      <form method="POST" action="/api/auth/login" className="relative w-full max-w-md">
        <div className="mx-auto mb-4 h-[2px] w-24 rounded-full"
             style={{ background: `linear-gradient(90deg, transparent, ${goldLux}, transparent)`, boxShadow: goldGlow }} />

        <div className="p-6 border rounded-2xl md:p-8"
             style={{
               borderColor: 'rgba(212,175,55,.28)',
               background:
                 'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)), ' +
                 'radial-gradient(120% 140% at 0% 0%, rgba(212,175,55,.08), transparent 60%), rgba(17,20,24,.85)',
               boxShadow: `0 10px 30px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06), ${goldGlow}`,
               backdropFilter: 'blur(8px) saturate(1.05)',
             }}>
          <h1 className="text-2xl font-semibold tracking-tight"
              style={{
                background: `linear-gradient(90deg, ${goldLux}, #fff)`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                textShadow: '0 2px 18px rgba(212,175,55,.18)',
              }}>
            Admin Sign In
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,.68)' }}>
            Welcome back. Please use your <span style={{ color: goldLux }}>admin</span> credentials.
          </p>

          {err === '1' && (
            <div className="px-3 py-2 mt-4 text-sm rounded-lg"
                 style={{
                   color: '#fff',
                   background: 'linear-gradient(180deg, rgba(220,38,38,.22), rgba(220,38,38,.12))',
                   border: '1px solid rgba(220,38,38,.35)',
                 }}>
              Invalid credentials. Please try again.
            </div>
          )}

          <input type="hidden" name="next" value={next} />

          <label className="block mt-6">
            <div className="mb-1 text-sm" style={{ color: 'rgba(255,255,255,.8)' }}>Email or Username</div>
            <input name="identifier" required placeholder="you@example.com or admin"
                   className="w-full px-3 py-2 outline-none rounded-xl"
                   style={{
                     minHeight: 44, background: 'rgba(255,255,255,.06)',
                     border: '1px solid rgba(212,175,55,.26)', color: '#e5e7eb',
                     boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
                   }} />
          </label>

          <label className="block mt-4">
            <div className="mb-1 text-sm" style={{ color: 'rgba(255,255,255,.8)' }}>Password</div>
            <input name="password" type="password" required placeholder="••••••••"
                   className="w-full px-3 py-2 outline-none rounded-xl"
                   style={{
                     minHeight: 44, background: 'rgba(255,255,255,.06)',
                     border: '1px solid rgba(212,175,55,.26)', color: '#e5e7eb',
                     boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05)',
                   }} />
          </label>

          <button type="submit" className="w-full mt-6 font-semibold tracking-wide rounded-xl"
                  style={{
                    minHeight: 46, color: '#0b0d10',
                    background: `linear-gradient(135deg, ${goldDeep}, ${goldLux})`,
                    boxShadow: `${goldGlow}, inset 0 1px 0 rgba(255,255,255,.18)`,
                    border: '1px solid rgba(212,175,55,.55)',
                    textShadow: '0 1px 0 rgba(255,255,255,.15)',
                  }}>
            Sign in
          </button>

          <div className="flex items-center justify-between mt-4 text-sm">
            <a href="/" className="underline" style={{ color: goldLux }}>Back to site</a>
            <a href="/api/auth/logout" className="underline" style={{ color: 'rgba(255,255,255,.6)' }}>Reset session</a>
          </div>
        </div>

        <div className="mx-auto mt-4 h-[2px] w-24 rounded-full"
             style={{ background: `linear-gradient(90deg, transparent, ${goldLux}, transparent)`, boxShadow: goldGlow }} />
      </form>
    </div>
  );
}
