// app/layout.tsx
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import NextDynamic from 'next/dynamic';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Invitation App',
  description: 'Event registration & check-in',
};

const PwaRegister = NextDynamic(() => import('@/components/PwaRegister'), { ssr: false });
const HeaderStrip  = NextDynamic(() => import('@/components/HeaderStrip'),  { ssr: false });
const SiteHeader   = NextDynamic(() => import('@/components/SiteHeader'),   { ssr: false });

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

let warnedOnce = false;
async function getOrganizerBrandSafe() {
  // Let you skip DB at build / offline
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_IN_LAYOUT === '1') {
    if (process.env.NODE_ENV !== 'production' && !warnedOnce) {
      console.warn('[layout] Skipping DB brand fetch (offline). Using default brand.');
      warnedOnce = true;
    }
    return null;
  }
  try {
    return await prisma.organizer.findFirst({ select: { name: true, brand: true } });
  } catch {
    if (process.env.NODE_ENV !== 'production' && !warnedOnce) {
      console.warn('[layout] DB offline – using default brand. This is non-fatal.');
      warnedOnce = true;
    }
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrganizerBrandSafe();
  const brand = normalizeBrand(org?.brand);

  // tokens for public theme
  const primary   = (brand.primary as string)    || '#37e3c2';
  const secondary = (brand.secondary as string)  || '#9aa3af';
  const button    = (brand.button as string)     || '#8b5cf6';
  const brandBlue = (brand.headerBlue as string) || '#2439A8';
  const ctaLime   = (brand.cta as string)        || '#B7E000';

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

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={ctaLime} />
        <style
          dangerouslySetInnerHTML={{ __html: cssVars }}
          suppressHydrationWarning
        />
      </head>
      <body className="min-h-screen">
        <PwaRegister />
        <HeaderStrip />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
