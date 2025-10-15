// app/admin/BrandVars.tsx
// app/admin/BrandVars.tsx
import { prisma } from '@/lib/db';

function hex(v: string | undefined, fallback: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v || '') ? (v as string) : fallback;
}

export default async function BrandVars() {
  const org = await prisma.organizer.findFirst({ select: { brand: true } });
  const b = (typeof org?.brand === 'object' && org?.brand) ? (org!.brand as any) : {};
  const css = `
:root{
  --brand-primary:${hex(b.primary,   '#111827')};
  --brand-secondary:${hex(b.secondary, '#F59E0B')};
  --brand-button:${hex(b.button,    '#111827')};
  --accent:${hex(b.headerBlue, '#1D4ED8')};
}
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
