import { redirect } from 'next/navigation';

// Legacy route kept for backwards-compat.
// Admin event management now lives under /admin/events/[slug].
export default function LegacyAdminEventPage({ params }: { params: { slug: string } }) {
  redirect(`/admin/events/${encodeURIComponent(params.slug)}`);
}
