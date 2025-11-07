// components/SiteFooter.tsx
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10">
      <div className="py-8 text-sm container-page text-white/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            © {new Date().getFullYear()} <span className="text-white/85">Invitation App</span>. All rights reserved.
            <span className="mx-2">•</span>
            Developed by{' '}
            <a
              href="https://triggerdxb.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
              title="Trigger Motion Picture Productions"
            >
              Trigger Motion Picture Productions
            </a>
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link href="/about"  className="a-btn a-btn--ghost px-3 py-1.5 h-8">About</Link>
            <Link href="/scan"   className="a-btn a-btn--ghost px-3 py-1.5 h-8">Scanner</Link>
            <Link href="/admin"  className="a-btn a-btn--ghost px-3 py-1.5 h-8">Admin</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
