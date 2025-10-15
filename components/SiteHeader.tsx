// components/SiteHeader.tsx
// components/SiteHeader.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteHeader() {
  const path = usePathname() || '/';

  // Hide the nav on public form pages like /e/prime-expo-2025
  const hideNav = path.startsWith('/e/');

  const items = [
    { href: '/',             label: 'Home'    },
    { href: '/scan',         label: 'Scanner' },
    { href: '/admin/events', label: 'Admin'   },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--surface)]/95 backdrop-blur">
      <div className="flex items-center justify-between container-page h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg shadow bg-gradient-to-b from-violet-400 to-violet-600" />
          <span className="font-semibold tracking-tight">Invitation App</span>
        </Link>

        {!hideNav && (
          <nav className="flex items-center gap-2">
            {items.map((it) => {
              const active = path === it.href || (it.href !== '/' && path.startsWith(it.href));
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    'a-btn a-btn--hero px-4 py-2 h-9 rounded-lg text-sm font-bold',
                    active ? 'a-btn--accent' : 'a-btn--ghost'
                  ].join(' ')}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
