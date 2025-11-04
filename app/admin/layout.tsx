// app/admin/layout.tsx
// app/admin/layout.tsx
import '@/app/admin/admin.css';
import AdminShell from './AdminShell';
import BrandVars from './BrandVars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // BrandVars runs on server and sets CSS vars before any client paint.
  // AdminShell handles dark/light toggle and header/nav chrome.
  return (
    <>
      <BrandVars />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
