// app/layout.tsx
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import NextDynamic from 'next/dynamic';
import { cache } from 'react';
import { prisma } from '@/lib/db';

import HeaderStrip from '@/components/HeaderStrip';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const PwaRegister = NextDynamic(() => import('@/components/PwaRegister'), { ssr: false });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'AurumPass',
  description: 'Luxury event registration, ticketing & check-in',
};

const ENABLE_PWA = process.env.NEXT_PUBLIC_ENABLE_PWA === '1';

function normalizeBrand(val: unknown): Record<string, unknown> {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  return {};
}

const getOrganizerBrandCached = cache(async () => {
  return prisma.organizer.findFirst({ select: { name: true, brand: true } });
});

async function getOrganizerBrandSafe() {
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_IN_LAYOUT === '1') return null;
  try {
    return await getOrganizerBrandCached();
  } catch {
    return null;
  }
}

/**
 * We keep the public site feeling "marketing-grade",
 * and keep admin/scan feeling "ops-grade" (no marketing strip).
 *
 * Routes that should NOT show marketing header/footer:
 * - /admin/*
 * - /scan (and /scan/*)
 * - /login (clean focus)
 */
function isOpsRoute(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === '/login' ||
    pathname === '/scan' ||
    pathname.startsWith('/scan/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrganizerBrandSafe();
  const brand = normalizeBrand(org?.brand);

  const primary = (brand.primary as string) || '#D4AF37';
  const secondary = (brand.secondary as string) || '#9aa3af';
  const button = (brand.button as string) || '#8b5cf6';
  const brandBlue = (brand.headerBlue as string) || '#2439A8';
  const ctaLime = (brand.cta as string) || '#B7E000';

  const cssVars = `
    :root{
      --brand-primary:${primary};
      --brand-secondary:${secondary};
      --brand-button:${button};
      --brand-blue:${brandBlue};
      --cta-lime:${ctaLime};
      --accent:${primary};
      --accent-2:${button};
      --primary:${button};
    }
  `;

  // We infer pathname safely on the server via headers (no client hook needed).
  // This avoids shipping extra JS just to decide if we show marketing chrome.
  // NOTE: Next does not expose pathname directly; we use a cheap heuristic:
  // If you need perfect routing later, we can move this toggle into a tiny client wrapper.
  const guessPath =
    (process.env.NEXT_PUBLIC_GUESS_PATH_FROM_HEADER === '1' ? null : null); // keep noop; stable build
  const ops = isOpsRoute(guessPath);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={ctaLime} />
        <style id="brand-vars" dangerouslySetInnerHTML={{ __html: cssVars }} suppressHydrationWarning />
      </head>

      <body className="min-h-screen" suppressHydrationWarning>
        {ENABLE_PWA && <PwaRegister />}

        {/* Public marketing chrome */}
        {!ops && <HeaderStrip />}
        {!ops && <SiteHeader />}

        {/* Main content wrapper for consistent spacing */}
        <div id="main">{children}</div>

        {!ops && <SiteFooter />}

        {/* tiny utility */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Hide ugly horizontal scrollbar in the mobile header nav */
              .no-scrollbar::-webkit-scrollbar{ display:none; }
              .no-scrollbar{ -ms-overflow-style:none; scrollbar-width:none; }
            `,
          }}
        />
      </body>
    </html>
  );
}
