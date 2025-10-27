// app/admin/events/[slug]/page.tsx
import dynamicImport from 'next/dynamic';
import { prisma } from '@/lib/db';
import { readAdminSessionFromCookies } from '@/lib/adminAuth';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Attendance = { total: number; attended: number; noShows: number };
type RegistrationDTO = {
  email: string;
  attended: boolean;
  registeredAt: string;
  scannedAt: string | null;
  scannedBy: string | null;
  checkedOutAt: string | null;
  checkedOutBy: string | null;
  qrToken: string;
  meta: unknown;
};

type AdminProps = {
  slug: string;
  title: string;
  attendance: Attendance;
  initialRegistrations: RegistrationDTO[];
};

const AdminDashboardClient = dynamicImport<AdminProps>(
  () =>
    import('@/app/admin/[slug]/AdminDashboardClient').then(
      (m) => m.default
    ),
  { ssr: false }
);

export default async function Page({ params }: { params: { slug: string } }) {
  // server-side auth check
  const sess = readAdminSessionFromCookies();
  if (!sess) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/admin/events/${params.slug}`
      )}`
    );
  }

  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true, slug: true },
  });
  if (!event)
    return <div className="p-4 a-card">Event not found.</div>;

  const regsDb = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: [{ registeredAt: 'desc' }],
    select: {
      email: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
      qrToken: true,
      meta: true,
    },
  });

  const initialRegistrations: RegistrationDTO[] = regsDb.map((r) => ({
    email: r.email,
    attended: r.attended,
    registeredAt: r.registeredAt.toISOString(),
    scannedAt: r.scannedAt ? r.scannedAt.toISOString() : null,
    scannedBy: r.scannedBy ?? null,
    checkedOutAt: r.checkedOutAt
      ? r.checkedOutAt.toISOString()
      : null,
    checkedOutBy: r.checkedOutBy ?? null,
    qrToken: r.qrToken,
    meta: r.meta,
  }));

  const [total, attended] = await Promise.all([
    prisma.registration.count({
      where: { eventId: event.id },
    }),
    prisma.registration.count({
      where: { eventId: event.id, attended: true },
    }),
  ]);

  return (
    <AdminDashboardClient
      slug={event.slug}
      title={event.title}
      attendance={{
        total,
        attended,
        noShows: Math.max(0, total - attended),
      }}
      initialRegistrations={initialRegistrations}
    />
  );
}
