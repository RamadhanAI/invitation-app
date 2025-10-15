import { prisma } from '@/lib/db';
import RegistrationForm from '@/components/RegistrationForm';
import EventBanner from '@/components/EventBanner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeBrand(val: unknown): Record<string, unknown> {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  return {};
}

async function getEventSafe(slug: string) {
  try {
    return await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        price: true,
        currency: true,
        venue: true,
        description: true,
        capacity: true,
        organizer: { select: { brand: true } },
      },
    });
  } catch (e) {
    console.error('[event] DB error:', e);
    return null;
  }
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const event = await getEventSafe(params.slug);
  if (!event) {
    return (
      <div className="pb-8">
        <div className="container-page">
          <section className="p-6 mt-6 glass rounded-2xl">
            <h1 className="text-2xl font-semibold">Event temporarily unavailable</h1>
            <p className="mt-2 text-white/70">
              We’re having trouble reaching the database right now. Please refresh in a moment.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const isFree = event.price === 0;
  const priceText = isFree ? 'Free entry' : `${event.currency ?? 'USD'} ${(event.price / 100).toFixed(2)}`;
  const brand = normalizeBrand(event.organizer?.brand);
  const headerHref = (brand as any)?.banners?.header?.href as string | undefined;
  const footerHref = (brand as any)?.banners?.footer?.href as string | undefined;

  return (
    <div className="pb-8">
      {/* Header banner */}
      <EventBanner slug={event.slug} position="header" brand={brand as any} clickableHref={headerHref} />

      {/* Page content */}
      <div className="container-page">
        {/* Hero */}
        <section className="p-6 mt-6 mb-8 glass rounded-2xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 text-sm text-white/60">Demo Organizer</div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{event.title}</h1>
              <div className="mt-2 text-sm text-white/70">
                {event.date ? new Date(event.date).toLocaleString() : ''}
                {event.venue ? ` · ${event.venue}` : ''}
                {typeof event.capacity === 'number' ? ` · Capacity ${event.capacity}` : ''}
              </div>
            </div>
            <div
              className={`self-start rounded-xl px-3 py-1.5 text-sm font-medium ${
                isFree ? 'bg-emerald-600/20 text-emerald-300' : 'bg-violet-600/20 text-violet-300'
              }`}
              title={isFree ? 'No payment required' : 'Payment collected on registration'}
            >
              {priceText}
            </div>
          </div>

          {event.description && (
            <p className="mt-4 leading-relaxed text-white/70">{event.description}</p>
          )}
        </section>

        {/* Form + preview */}
        <section className="p-4 glass rounded-2xl banana-sheen-hover md:p-6">
          <RegistrationForm eventSlug={event.slug} />
          <div className="mt-4 text-xs text-white/50">
            By registering, you agree to receive a confirmation email with your ticket.
          </div>
        </section>
      </div>

      {/* Footer banner */}
      <EventBanner slug={event.slug} position="footer" brand={brand as any} clickableHref={footerHref} />
    </div>
  );
}
