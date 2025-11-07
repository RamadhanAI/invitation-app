// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import NextDynamic from 'next/dynamic';
import { cache } from 'react';
import { prisma } from '@/lib/db';

// ⬇️ keep only PWA client-only
const PwaRegister = NextDynamic(() => import('@/components/PwaRegister'), { ssr: false });

// ⬇️ SSR these so they render on first paint
import HeaderStrip from '@/components/HeaderStrip';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Invitation App',
  description: 'Event registration & check-in',
};

const ENABLE_PWA = process.env.NEXT_PUBLIC_ENABLE_PWA === '1';

function normalizeBrand(val: unknown): Record<string, unknown> {
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>; } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  return {};
}

const getOrganizerBrandCached = cache(async () => {
  return prisma.organizer.findFirst({ select: { name: true, brand: true } });
});

async function getOrganizerBrandSafe() {
  if (!process.env.DATABASE_URL || process.env.SKIP_DB_IN_LAYOUT === '1') return null;
  try { return await getOrganizerBrandCached(); } catch { return null; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrganizerBrandSafe();
  const brand = normalizeBrand(org?.brand);

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
        <style id="brand-vars" dangerouslySetInnerHTML={{ __html: cssVars }} suppressHydrationWarning />
      </head>
      <body className="min-h-screen">
        {ENABLE_PWA && <PwaRegister />}
        <HeaderStrip />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
