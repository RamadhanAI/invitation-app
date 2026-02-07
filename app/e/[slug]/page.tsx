// app/e/[slug]/page.tsx
// app/e/[slug]/page.tsx
import RegistrationFormFlip from '@/components/RegistrationForm';
import EventBanner from '@/components/EventBanner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeBrand(val: unknown): Record<string, unknown> {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as any;
    } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as any;
  return {};
}

function formatEventMeta(opts: { date: Date | string | null; venue?: string | null; capacity?: number | null }) {
  const parts: string[] = [];
  if (opts.date) {
    const dt = new Date(opts.date);
    const when = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Dubai',
    }).format(dt);
    parts.push(when);
  }
  if (opts.venue && String(opts.venue).trim()) parts.push(String(opts.venue));
  if (typeof opts.capacity === 'number') parts.push(`Capacity ${opts.capacity}`);
  return parts.join(' · ');
}

function pickBrandString(brand: Record<string, unknown>, paths: string[], fallback?: string) {
  for (const path of paths) {
    const keys = path.split('.');
    let cur: any = brand;
    let ok = true;
    for (const k of keys) {
      if (!cur || typeof cur !== 'object' || !(k in cur)) {
        ok = false;
        break;
      }
      cur = cur[k];
    }
    if (ok && typeof cur === 'string' && cur.trim()) return cur.trim();
  }
  return fallback;
}

function getServerBaseUrl() {
  const base =
    (process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      'http://localhost:3000') as string;

  const trimmed = base.replace(/\/$/, '');
  // VERCEL_URL is often just the host without protocol
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function fetchEvent(slug: string) {
  const safe = encodeURIComponent(slug || '');
  const url = `${getServerBaseUrl()}/api/events/${safe}/details`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-store' },
    });

    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.ok || !json?.event) return null;
    return json.event as any;
  } catch {
    return null;
  }
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const slug = (params?.slug || '').toString();
  const event = await fetchEvent(slug);

  if (!event) {
    return (
      <div className="pb-8">
        <div className="container-page">
          <section className="p-6 mt-6 glass rounded-2xl">
            <h1 className="text-2xl font-semibold">Event temporarily unavailable</h1>
            <p className="mt-2 text-white/70">We couldn’t load this event right now. Please refresh in a moment.</p>
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

  const sponsorLogoUrl = (brand as any)?.sponsorLogoUrl || undefined;
  const metaLine = formatEventMeta({ date: event.date, venue: event.venue, capacity: event.capacity });

  const bannerTitle =
    pickBrandString(brand as any, ['banner.title', 'banners.title', 'appName', 'name'], 'AurumPass') || 'AurumPass';

  const bannerSubtitle =
    pickBrandString(
      brand as any,
      ['banner.subtitle', 'banners.subtitle', 'tagline'],
      'Luxury Ticketing • AI Check-In • Dubai ↔ Ghana'
    ) || 'Luxury Ticketing • AI Check-In • Dubai ↔ Ghana';

  const emblemUrl = pickBrandString(brand as any, ['banner.emblemUrl', 'banners.emblemUrl'], undefined);

  return (
    <div className="pb-8">
      <EventBanner
        slug={event.slug}
        position="header"
        brand={brand as any}
        clickableHref={headerHref}
        mode="overlay"
        overlay={{
          title: bannerTitle,
          subtitle: bannerSubtitle,
          emblemUrl: emblemUrl || undefined,
        }}
      />

      <div className="container-page">
        <section className="p-6 mt-6 mb-8 glass rounded-2xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 text-sm text-white/60">AurumPass Demo</div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{event.title}</h1>
              <div className="mt-2 text-sm text-white/70">{metaLine}</div>
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

          {event.description && <p className="mt-4 leading-relaxed text-white/70">{event.description}</p>}
        </section>

        <section className="p-4 glass rounded-2xl md:p-6">
          <RegistrationFormFlip eventSlug={event.slug} sponsorLogoUrl={sponsorLogoUrl} />
          <div className="mt-4 text-xs text-white/50">By registering, you agree to receive a confirmation email.</div>
        </section>
      </div>

      <EventBanner
        slug={event.slug}
        position="footer"
        brand={brand as any}
        clickableHref={footerHref}
        mode="overlay"
        overlay={{
          title: bannerTitle,
          subtitle: bannerSubtitle,
          emblemUrl: emblemUrl || undefined,
        }}
      />
    </div>
  );
}
