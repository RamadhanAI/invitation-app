import Link from 'next/link';

export default function SiteHeader() {
  const items = [
    { href: '/',      label: 'Home'   },
    { href: '/scan',  label: 'Scanner'},
    { href: '/admin', label: 'Admin'  },
    { href: '/about', label: 'About'  },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--surface)]/95 backdrop-blur">
      <div className="flex items-center justify-between container-page h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg shadow bg-gradient-to-b from-violet-400 to-violet-600" />
          <span className="font-semibold tracking-tight">Invitation App</span>
        </Link>

        <nav className="flex items-center gap-2">
          {items.map(it => (
            <Link
              key={it.href}
              href={it.href}
              className="px-4 py-2 text-sm font-bold rounded-lg a-btn a-btn--hero h-9 a-btn--ghost"
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
