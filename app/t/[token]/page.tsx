// app/t/[token]/page.tsx
// app/t/[token]/page.tsx
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { prisma } from '@/lib/db';
import { isLikelyJwt, verifyTicket } from '@/lib/tokens';
import TicketActions from '@/components/TicketActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveRegistration(token: string) {
  if (isLikelyJwt(token)) {
    const p = await verifyTicket(token);
    if (p?.sub) {
      const reg = await prisma.registration.findUnique({
        where: { id: p.sub },
        select: {
          id: true, email: true, paid: true, registeredAt: true, qrToken: true, meta: true,
          event: { select: { title: true, date: true, venue: true, currency: true, price: true, slug: true } },
        },
      });
      if (reg) return reg;
    }
  }
  return prisma.registration.findFirst({
    where: { qrToken: token },
    select: {
      id: true, email: true, paid: true, registeredAt: true, qrToken: true, meta: true,
      event: { select: { title: true, date: true, venue: true, currency: true, price: true, slug: true } },
    },
  });
}

function parseMeta(meta: unknown): Record<string, any> {
  try {
    if (!meta) return {};
    if (typeof meta === 'string') return JSON.parse(meta);
    if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, any>;
    return {};
  } catch { return {}; }
}
function nameFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  const first = (m.firstName ?? m.firstname ?? m.givenName ?? '').toString().trim();
  const last  = (m.lastName  ?? m.lastname  ?? m.familyName ?? '').toString().trim();
  const full  = (m.fullName ?? m.name ?? '').toString().trim();
  return (full || `${first} ${last}`.trim()).trim();
}
function jobFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  return (m.jobTitle ?? m.designation ?? m.title ?? '').toString().trim();
}
function companyFromMeta(meta: unknown): string {
  const m = parseMeta(meta);
  return (m.companyName ?? m.company ?? m.org ?? '').toString().trim();
}

export default async function TicketPage({
  params, searchParams,
}: { params: { token: string }, searchParams?: { view?: string } }) {
  const reg = await resolveRegistration(params.token);
  if (!reg) notFound();

  const attendeeName = nameFromMeta(reg.meta) || reg.email;
  const event = reg.event!;
  const when  = event.date ? new Date(event.date).toLocaleString() : '';
  const status = reg.paid || (event.price ?? 0) === 0 ? 'Paid / Free' : 'Unpaid';

  const dataUrl = await QRCode.toDataURL(reg.qrToken, { margin: 1, scale: 8 });
  const pngUrl = `/api/ticket/png?token=${encodeURIComponent(reg.qrToken)}&dpi=300`;

  if ((searchParams?.view || '').toLowerCase() === 'badge') {
    const job = jobFromMeta(reg.meta);
    const company = companyFromMeta(reg.meta);
    const roleLabel = 'VISITOR';
    return (
      <div className="grid place-items-center">
        <div className="w-full max-w-lg p-6 a-card md:p-8 banana-card">
          <div className="mb-3 text-xs font-semibold tracking-wide text-white/70">BADGE PREVIEW</div>
          <div className="mx-auto w-[320px] rounded-2xl bg-white text-center shadow-lg">
            <div className="h-4 rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#34d399,#60a5fa)' }} />
            <div className="px-6 pt-5 pb-6">
              <div className="w-24 mx-auto mb-4 bg-gray-200 rounded-lg h-28" />
              <div className="text-lg font-extrabold tracking-wide text-gray-900">{attendeeName.toUpperCase()}</div>
              {job && <div className="mt-1 text-xs font-semibold text-gray-600">{job}</div>}
              {company && <div className="text-xs text-gray-500">{company}</div>}
              <div className="mx-auto mt-5 inline-flex w-full max-w-[220px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white"
                   style={{ background: 'linear-gradient(90deg,#6366f1,#3b82f6)' }}>
                {roleLabel}
              </div>
              <div className="mt-6 text-[10px] leading-4 text-gray-400">
                Important: This is a preview of your badge information only. Your valid QR ticket will be emailed after you complete registration.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dataUrl} alt="Ticket QR" className="p-2 bg-white rounded-lg h-44 w-44" />
          </div>
          <div className="mt-4"><TicketActions pngUrl={pngUrl} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center">
      <div className="w-full max-w-lg p-6 card ticket md:p-8 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">{event.title}</div>
          <div className="text-xs text-white/60">Ticket</div>
        </div>
        <div className="mt-2 text-sm text-white/70">
          {when}{event.venue ? ` · ${event.venue}` : ''}
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
        <TicketActions pngUrl={pngUrl} />
      </div>
      <div className="mt-6 text-xs text-white/40">
        Show this code at the entrance. Treat this token like a password.
      </div>
    </div>
  );
}
