// components/SiteFooter.tsx
// components/SiteFooter.tsx
import Link from 'next/link';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10">
      {/* Premium CTA band */}
      <div className="container-page">
        <div className="p-6 mt-10 glass md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-white">
                Make your entrance feel effortless.
              </div>
              <div className="mt-1 text-sm text-white/70 max-w-[70ch]">
                Premium registration, cinematic QR passes, and fast check-in — built for teams who care about first impressions.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/request-demo" className="btn btn-primary">
                Request a demo
              </Link>
              <Link href="/about" className="btn btn-ghost">
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer content */}
      <div className="py-10 text-sm container-page text-white/70">
        <div className="grid gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg shadow bg-gradient-to-b from-amber-300 to-amber-700 ring-1 ring-white/10" />
              <div className="font-semibold tracking-tight text-white/90">AurumPass</div>
              <span className="badge">VIP-grade</span>
            </div>
            <p className="mt-3 text-white/65 max-w-[55ch]">
              Luxury ticketing and check-in for modern events. Designed to look premium to guests —
              and feel simple for the team running the door.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="badge">QR passes</span>
              <span className="badge">Fast scanning</span>
              <span className="badge">Exports</span>
              <span className="badge">Branding</span>
            </div>
          </div>

          <div className="grid gap-6 md:col-span-7 sm:grid-cols-3">
            <div>
              <div className="font-semibold text-white/85">Product</div>
              <div className="flex flex-col gap-2 mt-3">
                <Link className="hover:text-white/90" href="/about">Overview</Link>
                <Link className="hover:text-white/90" href="/scan">Scanner</Link>
                <Link className="hover:text-white/90" href="/admin">Admin</Link>
              </div>
            </div>

            <div>
              <div className="font-semibold text-white/85">Company</div>
              <div className="flex flex-col gap-2 mt-3">
                <Link className="hover:text-white/90" href="/request-demo">Request a demo</Link>
                <Link className="hover:text-white/90" href="/">Home</Link>
                <Link className="hover:text-white/90" href="/about">About</Link>
              </div>
            </div>

            <div>
              <div className="font-semibold text-white/85">Built by</div>
              <div className="mt-3 text-white/65">
                Top Prestige Technologies LLC
              </div>
              <div className="mt-2 text-xs text-white/55">
                Engineered for premium experiences where the first impression starts at the gate.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 mt-10 border-t md:flex-row md:items-center md:justify-between border-white/10">
          <div>
            © {year} <span className="text-white/85">AurumPass</span>. All rights reserved.
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link href="/about" className="btn btn-ghost px-3 py-1.5 h-8">About</Link>
            <Link href="/scan" className="btn btn-ghost px-3 py-1.5 h-8">Scanner</Link>
            <Link href="/admin" className="btn btn-ghost px-3 py-1.5 h-8">Admin</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
