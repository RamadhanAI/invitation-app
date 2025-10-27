// app/admin/events/[slug]/stations/page.tsx
import dynamicImport from 'next/dynamic';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { readAdminSessionFromCookies } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AdminStationsClient = dynamicImport(
  () => import('@/components/Admin/AdminStationsClient'),
  { ssr: false }
);

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  // server-side auth gate
  const sess = readAdminSessionFromCookies();
  if (!sess) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/admin/events/${params.slug}/stations`
      )}`
    );
  }

  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true },
  });
  if (!event) return notFound();

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
