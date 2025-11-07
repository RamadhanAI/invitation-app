// lib/email.ts
import QRCode from 'qrcode';
import { prisma } from './db';
import { normalizeMeta, type AttendeeMeta } from './meta';
import { buildBadgeHTML, type Brand, type EventLite } from './emailTemplate';

let resendClient: any | null = null;
async function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function baseFrom(appUrl?: string, h?: Headers | HeadersInit): string {
  if (appUrl) return appUrl.replace(/\/+$/, '');
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  try {
    const headers = new Headers(h);
    const proto = headers.get('x-forwarded-proto') || 'https';
    const host  = headers.get('x-forwarded-host') || headers.get('host');
    if (host) return `${proto}://${host}`;
  } catch {}
  return 'http://localhost:3000';
}

function normalizeBrand(val: unknown): Brand {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Brand;
    } catch {}
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Brand;
  return {};
}

function icsForEvent(ev: EventLite, email?: string) {
  const start = ev.date ? new Date(ev.date) : null;
  const end   = start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null;
  const ts = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InvitationApp//Ticket//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Math.random().toString(36).slice(2)}@invitation-app`,
    start ? `DTSTART:${ts(start)}` : '',
    end   ? `DTEND:${ts(end)}`     : '',
    `SUMMARY:${ev.title}`,
    ev.venue ? `LOCATION:${ev.venue}` : '',
    email ? `ATTENDEE:MAILTO:${email}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

const s = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);

/* ---------------- Public API ---------------- */

type LegacyArgs = { to: string; eventId: string; qrToken: string };
type V2Args = {
  to: string;
  brand: Brand;
  event: EventLite & { slug?: string };
  token: string;
  meta: AttendeeMeta;
  attachments?: Array<{ filename: string; content: string; type?: string; disposition?: string; contentId?: string; }>;
  appUrl?: string;
  ticketUrl?: string;
};

export async function sendRegistrationEmail(args: LegacyArgs): Promise<void>;
export async function sendRegistrationEmail(args: V2Args): Promise<void>;
export async function sendRegistrationEmail(args: LegacyArgs | V2Args): Promise<void> {
  const resend = await getResend();
  if (!resend) return;

  if ('eventId' in args) {
    const event = await prisma.event.findUnique({
      where: { id: args.eventId },
      select: { title: true, price: true, currency: true, date: true, venue: true, organizer: { select: { brand: true, name: true } } },
    });
    if (!event) return;

    const reg = await prisma.registration.findFirst({
      where: { eventId: args.eventId, email: args.to },
      select: { meta: true },
    });

    const brand = normalizeBrand(event.organizer?.brand);
    const meta  = normalizeMeta(reg?.meta);

    await sendEmailInternal(resend, {
      to: args.to,
      brand,
      event: { title: event.title, date: event.date ?? undefined, venue: event.venue ?? undefined, currency: event.currency, price: event.price },
      token: args.qrToken,
      meta,
      fromName: brand.emailFromName || event.organizer?.name || 'Your Events',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    return;
  }

  await sendEmailInternal(resend, {
    to: args.to,
    brand: args.brand,
    event: args.event,
    token: args.token,
    meta: args.meta,
    fromName: args.brand.emailFromName || 'Your Events',
    attachments: args.attachments,
    appUrl: args.appUrl,
  });
}

/* ---------------- Internal sender ---------------- */

async function sendEmailInternal(
  resend: any,
  opts: {
    to: string;
    brand: Brand;
    event: EventLite & { slug?: string };
    token: string;
    meta: AttendeeMeta;
    fromName: string;
    attachments?: Array<{ filename: string; content: string; type?: string; disposition?: string; contentId?: string; }>;
    appUrl?: string;
  }
) {
  const base = baseFrom(opts.appUrl, undefined);
  const roleUpper = (s(opts.meta.role) || 'ATTENDEE').toUpperCase();
  const fullName =
    s((opts.meta as any).fullName) ||
    [s(opts.meta.firstName), s(opts.meta.lastName)].filter(Boolean).join(' ') ||
    opts.to;

  const jobTitle = s(opts.meta.jobTitle);
  const company  = s(opts.meta.companyName) || s((opts.meta as any).company);
  const eventTitle = s(opts.event.title) || 'Event';
  const when  = opts.event.date ? new Date(opts.event.date).toLocaleString() : '';
  const venue = s(opts.event.venue);
  const whenWhere = [when, venue].filter(Boolean).join(' · ');
  const bust = Date.now().toString();

  // Build explicit front/back PNGs with all fields
  const frontPngUrl =
    `${base}/api/ticket/png?token=${encodeURIComponent(opts.token)}` +
    `&variant=front&width=1200&dpi=300&v=${bust}` +
    `&name=${encodeURIComponent(fullName)}` +
    `&title=${encodeURIComponent(jobTitle)}` +
    `&company=${encodeURIComponent(company)}` +
    `&label=${encodeURIComponent(roleUpper)}` +
    `&eventTitle=${encodeURIComponent(eventTitle)}` +
    `&eventTime=${encodeURIComponent(whenWhere)}`;

  const backPngUrl =
    `${base}/api/ticket/png?token=${encodeURIComponent(opts.token)}` +
    `&variant=back&width=1200&dpi=300&v=${bust}`;

  const printUrl = `${base}/t/${encodeURIComponent(opts.token)}/print`;

  // QR (fallback for strict email clients)
  const qrDataUrl = await QRCode.toDataURL(opts.token, { width: 400, margin: 1 });

  // Email HTML prefers the Front PNG (with attendee details)
  const html = buildBadgeHTML({
    brand: opts.brand,
    event: opts.event,
    token: opts.token,
    meta: opts.meta,
    appUrl: base,
    qrDataUrl,
    frontPngUrl,
    backPngUrl,
    printUrl,
  });

  // ICS
  const ics = Buffer.from(icsForEvent(opts.event, opts.to), 'utf8');

  // Attach the front image as ticket.png (use URL above)
  let ticketPngBase64: string | null = null;
  const allowLocalAttach = process.env.EMAIL_ATTACH_BADGE === '1';
  try {
    if (allowLocalAttach || !/^https?:\/\/localhost/i.test(base)) {
      const pngRes = await fetch(frontPngUrl, { cache: 'no-store' });
      if (pngRes.ok) {
        ticketPngBase64 = Buffer.from(await pngRes.arrayBuffer()).toString('base64');
      } else {
        console.warn('[email] ticket/png fetch failed:', pngRes.status, pngRes.statusText);
      }
    } else {
      console.warn('[email] Skipping ticket/png fetch on localhost (set EMAIL_ATTACH_BADGE=1 to allow).');
    }
  } catch (e) {
    console.warn('[email] ticket/png fetch error:', e);
  }

  if (!ticketPngBase64) {
    try {
      const qrFallback = await QRCode.toDataURL(opts.token, { width: 600, margin: 1 });
      const base64 = qrFallback.split(',')[1] || '';
      if (base64) ticketPngBase64 = base64;
    } catch (e) {
      console.warn('[email] QR fallback error:', e);
    }
  }

  const attachments: Array<{ filename: string; content: string | Buffer; contentType?: string }> = [
    { filename: `${(opts.event as any).slug || 'event'}.ics`, content: Buffer.from(ics.toString('base64'), 'utf8'), contentType: 'text/calendar; charset=utf-8; method=PUBLISH' },
  ];
  if (ticketPngBase64) {
    attachments.push({ filename: 'ticket.png', content: ticketPngBase64, contentType: 'image/png' });
  }
  if (opts.attachments?.length) {
    for (const a of opts.attachments) {
      attachments.push({ filename: a.filename, content: a.content, contentType: a.type });
    }
  }

  const from = process.env.EMAIL_FROM?.trim() || 'Invitation App <tickets@triggerdxb.com>';
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `${eventTitle} — Your Ticket`,
    html,
    text: `Your ticket for ${eventTitle}. Present the attached badge or open the print page: ${printUrl}`,
    attachments,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw error;
  }
}
