import { redirect } from 'next/navigation';

// Legacy route kept for backwards-compat.
export default function LegacyImportPage({ params }: { params: { slug: string } }) {
  redirect(`/admin/events/${encodeURIComponent(params.slug)}/import`);
}
