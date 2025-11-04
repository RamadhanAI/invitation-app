// app/admin/BrandVars.tsx
// app/admin/BrandVars.tsx
import { prisma } from '@/lib/db';

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

export default async function BrandVars() {
  // get organizer brand so admin header gradients match the org
  let brandObj: Record<string, any> = {};
  try {
    const org = await prisma.organizer.findFirst({
      select: { brand: true },
    });
    brandObj = normalizeBrand(org?.brand) as any;
  } catch {
    brandObj = {};
  }

  const primary    = brandObj.primary    || '#111827';
  const secondary  = brandObj.secondary  || '#F59E0B';
  const button     = brandObj.button     || '#111827';
  const headerBlue = brandObj.headerBlue || '#1D4ED8';

  // Inject into :root; admin.css uses these custom props.
  const cssVars = `
    :root{
      --brand-primary:${primary};
      --brand-secondary:${secondary};
      --brand-button:${button};
      --accent:${headerBlue};
    }
  `;

  return (
    <style
      dangerouslySetInnerHTML={{ __html: cssVars }}
      suppressHydrationWarning
    />
  );
}
