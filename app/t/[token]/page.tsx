// app/t/[token]/page.tsx
// app/t/[token]/page.tsx
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { isLikelyJwt, verifyTicket } from '@/lib/tokens';
import TicketActions from '@/components/TicketActions';
import BadgePedestal from '@/components/BadgePedestal';
import BadgePreviewFlip from '@/components/BadgePreviewFlip';
import { resolveBadgeConfig, badgeConfigToQuery } from '@/lib/badgeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveRegistration(token: string) {
  if (isLikelyJwt(token)) {
    const p = await verifyTicket(token);
    if (p?.sub) {
      const reg = await prisma.registration.findUnique({
        where: { id: p.sub },
        select: {
          id: true,
          email: true,
          paid: true,
          registeredAt: true,
          qrToken: true,
          meta: true,
          event: {
            select: {
              title: true,
              date: true,
              venue: true,
              currency: true,
              price: true,
              slug: true,
              organizer: { select: { brand: true } }, // ✅ NEW
            },
          },
        },
      });
      if (reg) return reg;
    }
  }

  return prisma.registration.findFirst({
    where: { qrToken: token },
    select: {
      id: true,
      email: true,
      paid: true,
      registeredAt: true,
      qrToken: true,
      meta: true,
      event: {
        select: {
          title: true,
          date: true,
          venue: true,
          currency: true,
          price: true,
          slug: true,
          organizer: { select: { brand: true } }, // ✅ NEW
        },
      },
    },
  });
}

function parseMeta(meta: unknown): Record<string, any> {
  try {
    if (!meta) return {};
    if (typeof meta === 'string') return JSON.parse(meta);
    if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, any>;
    return {};
  } catch {
    return {};
  }
}

const nameFromMeta = (meta: unknown) => {
  const m = parseMeta(meta);
  const first = (m.firstName ?? m.firstname ?? m.givenName ?? '').toString().trim();
  const last = (m.lastName ?? m.lastname ?? m.familyName ?? '').toString().trim();
  const full = (m.fullName ?? m.name ?? '').toString().trim();
  return (full || `${first} ${last}`.trim()).trim();
};

const jobFromMeta = (meta: unknown) =>
  (parseMeta(meta).jobTitle ?? parseMeta(meta).designation ?? parseMeta(meta).title ?? '').toString().trim();

const companyFromMeta = (meta: unknown) =>
  (parseMeta(meta).companyName ?? parseMeta(meta).company ?? parseMeta(meta).org ?? '').toString().trim();

function roleFromMeta(meta: unknown) {
  const m = parseMeta(meta);
  const raw = (m.role ?? m.badgeRole ?? m.ticketType ?? m.tier ?? '').toString().trim();
  const up = raw.toUpperCase();
  if (!up) return 'ATTENDEE';
  if (/^vip/.test(up)) return 'VIP';
  if (/staff|crew|team/.test(up)) return 'STAFF';
  if (/speak/.test(up)) return 'SPEAKER';
  if (/press|media/.test(up)) return 'MEDIA';
  return up;
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { view?: string };
}) {
  const reg = await resolveRegistration(params.token);
  if (!reg) notFound();

  const meta = parseMeta(reg.meta);
  const event = reg.event!;
  const organizerBrand = event.organizer?.brand;

  // ✅ effective badge config: organizer default → per-event → meta.badge
  const resolvedBadge = resolveBadgeConfig({
    organizerBrand,
    eventSlug: event.slug,
    requestBadgeOverride: meta.badge,
  });

  const attendeeName = nameFromMeta(reg.meta) || reg.email;
  const job = jobFromMeta(reg.meta);
  const company = companyFromMeta(reg.meta);
  const roleLabel = roleFromMeta(reg.meta);

  const sponsorLogoUrl =
    resolvedBadge.sponsorLogoUrl ||
    (meta.sponsorLogoUrl as string | undefined) ||
    undefined;

  const when = event.date ? new Date(event.date).toLocaleString() : '';
  const status = reg.paid || (event.price ?? 0) === 0 ? 'Paid / Free' : 'Unpaid';

  // ✅ include badge query so PNG matches preview
  const badgeQs = badgeConfigToQuery(resolvedBadge); // includes leading &
  const pngUrl = `/api/ticket/png?token=${encodeURIComponent(reg.qrToken)}&dpi=300${badgeQs}`;
  const printUrl = `/t/${encodeURIComponent(reg.qrToken)}/print`;

  if ((searchParams?.view || '').toLowerCase() === 'badge') {
    return (
      <div className="grid p-4 text-white place-items-center">
        <div className="w-full max-w-3xl p-6 a-card banana-card md:p-8">
          <div className="mb-4 text-xs font-semibold tracking-wide text-white/70">BADGE PREVIEW</div>

          <div className="flex items-center justify-center">
            <BadgePedestal className="w-[420px]">
              <BadgePreviewFlip
                width={420}
                token={reg.qrToken}
                fullName={attendeeName || '—'}
                jobTitle={job || ''}
                companyName={company || ''}
                role={roleLabel}
                sponsorLogoUrl={sponsorLogoUrl}
                badge={resolvedBadge} // ✅ use resolved config
              />
            </BadgePedestal>
          </div>

          <div className="mt-6">
            <TicketActions pngUrl={pngUrl} printUrl={printUrl} />
          </div>
        </div>
      </div>
    );
  }

  const dataUrl = await QRCode.toDataURL(reg.qrToken, { margin: 1, scale: 8 });

  return (
    <div className="grid p-4 place-items-center">
      <div className="w-full max-w-lg p-6 card ticket md:p-8 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{event.title}</div>
          <div className="text-xs text-white/60">Ticket</div>
        </div>

        <div className="mt-2 text-sm text-white/70">
          {when}
          {event.venue ? ` · ${event.venue}` : ''}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-white/50">Attendee</div>
              <div className="font-medium">{attendeeName}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Status</div>
              <div className="font-medium">{status}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Registered</div>
              <div className="font-medium">
                {reg.registeredAt ? new Date(reg.registeredAt).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="Ticket QR" className="p-2 bg-white rounded-lg w-44 h-44" />
          </div>
        </div>

        <TicketActions pngUrl={pngUrl} printUrl={printUrl} />
      </div>

      <div className="mt-6 text-xs text-white/40">
        Show this code at the entrance. Treat this token like a password.
      </div>
    </div>
  );
}
