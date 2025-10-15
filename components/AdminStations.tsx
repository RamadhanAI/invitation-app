//components/AdminStations.tsx
// components/AdminStations.tsx
import dynamic from 'next/dynamic';

// Client lives at components/Admin/AdminStationsClient.tsx
const AdminStationsClient = dynamic(
  () => import('@/components/Admin/AdminStationsClient'),
  { ssr: false }
);

export default function AdminStations({ slug }: { slug: string }) {
  return <AdminStationsClient slug={slug} />;
}
