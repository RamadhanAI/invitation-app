// app/admin/BrandVars.tsx
// app/admin/BrandVars.tsx
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeBrand(val: unknown): Record<string, any> {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, any>;
    } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, any>;
  return {};
}

export default async function BrandVars() {
  const sess = getAdminSession();

  // Tenant admins ALWAYS have oid (enforced by getAdminSession()).
  // Superadmin only has oid when impersonating.
  const targetOrgId =
    sess?.role === 'superadmin'
      ? (sess.oid || null) // impersonation target
      : (sess?.oid || null); // tenant's organizer

  // If superadmin is not impersonating, we don't want "random tenant branding".
  // Use safe defaults (platform look).
  let brandObj: Record<string, any> = {};

  if (targetOrgId) {
    try {
      const org = await prisma.organizer.findUnique({
        where: { id: targetOrgId },
        select: { brand: true },
      });
      brandObj = normalizeBrand(org?.brand);
    } catch {
      brandObj = {};
    }
  }

  const primary = brandObj.primary || '#D4AF37'; // gold
  const secondary = brandObj.secondary || '#F59E0B'; // amber
  const button = brandObj.button || '#8b5cf6'; // violet
  const headerBlue = brandObj.headerBlue || '#7aa2ff'; // luxury blue

  const cssVars = `
    #admin-root{
      --brand-primary:${primary};
      --brand-secondary:${secondary};
      --brand-button:${button};
      --accent:${headerBlue};
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: cssVars }} suppressHydrationWarning />;
}
