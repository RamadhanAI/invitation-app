// app/admin/layout.tsx
import '@/app/admin/admin.css';
import AdminShell from './AdminShell';
import BrandVars from './BrandVars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side injects CSS variables before paint → no FOUC
  return (
    <>
      <BrandVars />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
