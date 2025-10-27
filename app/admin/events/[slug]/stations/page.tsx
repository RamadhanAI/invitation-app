// app/admin/events/[slug]/stations/page.tsx
// app/admin/events/[slug]/stations/page.tsx

import dynamicImport from 'next/dynamic';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { readAdminSessionFromCookies } from '@/lib/adminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// We keep this as a client component via dynamic import with ssr: false
// because AdminStationsClient uses hooks, fetch, etc.
const AdminStationsClient = dynamicImport(
  () => import('@/components/Admin/AdminStationsClient'),
  { ssr: false }
);

export default async function StationsPage({
  params,
}: {
  params: { slug: string };
}) {
  // 1. Server-side auth gate.
  // readAdminSessionFromCookies() checks the inv_admin cookie signed with SESSION_SECRET.
  // If invalid/missing, we don't even render the page; we bounce to /login.
  const sess = readAdminSessionFromCookies();
  if (!sess.ok) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/admin/events/${params.slug}/stations`
      )}`
    );
  }

  // 2. Load event info for header (and to 404 if slug is bad instead of rendering a broken page)
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true },
  });

  if (!event) {
    notFound();
  }

  // 3. Render page shell + client component
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Scanners ·{' '}
          <span className="opacity-70">{event.title}</span>
        </h1>
      </div>

      <AdminStationsClient slug={params.slug} />
    </div>
  );
}
