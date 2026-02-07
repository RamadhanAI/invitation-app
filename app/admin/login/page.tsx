// app/admin/login/page.tsx
// app/admin/login/page.tsx
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  // Canonical human admin login
  redirect('/login?next=/admin');
}
