// app/admin/layout.tsx
import '@/app/admin/admin.css';
import type { ReactNode } from 'react';
import AdminShell from './AdminShell';
import BrandVars from './BrandVars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BrandVars />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
