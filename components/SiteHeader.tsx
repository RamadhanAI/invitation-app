// components/SiteHeader.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteHeader() {
  const pathname = usePathname();

  const items = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/scan', label: 'Scanner' },
    { href: '/admin', label: 'Admin' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname?.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-black focus:px-3 focus:py-2">
        Skip to content
      </a>

      <div className="flex items-center justify-between h-14 container-page">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative shadow w-7 h-7 rounded-xl ring-1 ring-white/10 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700">
            <div className="absolute inset-0 transition-opacity opacity-0 rounded-xl group-hover:opacity-100 bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
          </div>

          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-white/90">
              AurumPass
              <span className="ml-2 align-middle badge">Luxury</span>
            </div>
            <div className="hidden text-xs md:block text-white/50">
              Ticketing • Cinematic QR passes • Fast check-in
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="items-center hidden gap-2 md:flex">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    'btn btn-ghost h-9 px-3 text-sm',
                    active ? 'ring-1 ring-white/15 bg-white/5' : '',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <div className="items-center hidden gap-2 sm:flex">
            <Link href="/request-demo" className="px-4 text-sm btn btn-primary h-9">
              Request a demo
            </Link>
          </div>

          {/* Mobile: keep it simple + classy (no hamburger complexity) */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto max-w-[58vw] no-scrollbar">
            {items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    'btn btn-ghost h-9 px-3 text-sm whitespace-nowrap',
                    active ? 'ring-1 ring-white/15 bg-white/5' : '',
                  ].join(' ')}
                  aria-current={active ? 'page' : undefined}
                >
                  {it.label}
                </Link>
              );
            })}
            <Link href="/request-demo" className="px-4 text-sm btn btn-primary h-9 whitespace-nowrap">
              Demo
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
