// app/admin/events/[slug]/edit/page.tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function EditEventPage({
  params,
}: { params: { slug: string } }) {
  const event = await prisma.event.findUnique({
    where: { slug: params.slug },
  });
  if (!event) return notFound();

  return (
    <div className="max-w-3xl p-6 mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit: {event.title}</h1>
        <Link href={`/admin/events/${params.slug}`} className="text-sm underline">
          Back
        </Link>
      </div>

      {/* super-minimal form */}
      <form
        action={`/api/admin/events/${params.slug}`}
        method="post"
        className="grid gap-4"
      >
        <input type="hidden" name="_method" value="PATCH" />
        <label className="grid gap-1">
          <span className="text-sm">Title</span>
          <input
            name="title"
            defaultValue={event.title}
            className="p-2 border rounded"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Description</span>
          <textarea
            name="description"
            defaultValue={event.description ?? ''}
            className="p-2 border rounded"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Venue</span>
          <input
            name="venue"
            defaultValue={event.venue ?? ''}
            className="p-2 border rounded"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Price (integer)</span>
          <input
            name="price"
            type="number"
            defaultValue={event.price}
            className="p-2 border rounded"
          />
        </label>

        <button className="px-4 py-2 text-white bg-black rounded">
          Save changes
        </button>
      </form>
    </div>
  );
}
