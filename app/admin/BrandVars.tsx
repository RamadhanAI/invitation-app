// app/admin/BrandVars.tsx
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalize(val: unknown): Record<string, unknown> {
  if (typeof val === 'string') {
    try { const o = JSON.parse(val); if (o && typeof o === 'object') return o as Record<string, unknown>; } catch {}
  }
  if (val && typeof val === 'object') return val as Record<string, unknown>;
  return {};
}

function hex(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? v : '';
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : fallback;
}

export default async function BrandVars() {
  // Don’t break the page if DB isn’t reachable
  let brand: Record<string, unknown> = {};
  try {
    const org = await prisma.organizer.findFirst({ select: { brand: true } });
    brand = normalize(org?.brand);
  } catch {
    brand = {};
  }

  const primary    = hex(brand.primary,    '#111827');
  const secondary  = hex(brand.secondary,  '#F59E0B');
  const button     = hex(brand.button,     '#111827');
  const headerBlue = hex(brand.headerBlue, '#1D4ED8');
  const ctaLime    = hex(brand.cta,        '#B7E000');

  const css = `
    :root{
      --brand-primary:${primary};
      --brand-secondary:${secondary};
      --brand-button:${button};
      --brand-blue:${headerBlue};
      --cta-lime:${ctaLime};
      /* derived */
      --accent:${primary};
      --accent-2:${button};
      --primary:${button};
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} suppressHydrationWarning />;
}
