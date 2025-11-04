// lib/email.ts
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

function deriveBaseUrl(h?: Headers | HeadersInit): string {
  if (process.env.NEXT_PUBLIC_APP_URL)
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  try {
    const headers = new Headers(h);
    const proto = headers.get('x-forwarded-proto') || 'https';
    const host = headers.get('x-forwarded-host') || headers.get('host');
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
  const end = start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null;
  const ts = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InvitationApp//Ticket//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Math.random().toString(36).slice(2)}@invitation-app`,
    start ? `DTSTART:${ts(start)}` : '',
    end ? `DTEND:${ts(end)}` : '',
    `SUMMARY:${ev.title}`,
    ev.venue ? `LOCATION:${ev.venue}` : '',
    email ? `ATTENDEE:MAILTO:${email}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/* ---------------- Public API ---------------- */

type LegacyArgs = { to: string; eventId: string; qrToken: string };
type V2Args = {
  to: string;
  brand: Brand;
  event: EventLite & { slug?: string };
  token: string;
  meta: AttendeeMeta;
  attachments?: Array<{
    filename: string;
    content: string;
    type?: string;
    disposition?: string;
    contentId?: string;
  }>;
  appUrl?: string;
  ticketUrl?: string;
};

export async function sendRegistrationEmail(args: LegacyArgs): Promise<void>;
export async function sendRegistrationEmail(args: V2Args): Promise<void>;
export async function sendRegistrationEmail(
  args: LegacyArgs | V2Args
): Promise<void> {
  const resend = await getResend();
  if (!resend) return; // if Resend not configured, we silently don't send

  if ('eventId' in args) {
    // Legacy path
    const event = await prisma.event.findUnique({
      where: { id: args.eventId },
      select: {
        title: true,
        price: true,
        currency: true,
        date: true,
        venue: true,
        organizer: { select: { brand: true, name: true } },
      },
    });
    if (!event) return;

    const reg = await prisma.registration.findFirst({
      where: { eventId: args.eventId, email: args.to },
      select: { meta: true },
    });

    const brand = normalizeBrand(event.organizer?.brand);
    const meta = normalizeMeta(reg?.meta);

    await sendEmailInternal(resend, {
      to: args.to,
      brand,
      event: {
        title: event.title,
        date: event.date ?? undefined,
        venue: event.venue ?? undefined,
        currency: event.currency,
        price: event.price,
      },
      token: args.qrToken,
      meta,
      fromName:
        brand.emailFromName || event.organizer?.name || 'Your Events',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    });
    return;
  }

  // Modern path
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
    attachments?: Array<{
      filename: string;
      content: string;
      type?: string;
      disposition?: string;
      contentId?: string;
    }>;
    appUrl?: string;
  }
) {
  // QR data URL for email body
  const qrDataUrl = await QRCode.toDataURL(opts.token, {
    width: 400,
    margin: 1,
  });

  const html = buildBadgeHTML({
    brand: opts.brand,
    event: opts.event,
    token: opts.token,
    meta: opts.meta,
    appUrl: opts.appUrl,
    qrDataUrl,
  });

  // .ics calendar
  const ics = Buffer.from(icsForEvent(opts.event, opts.to), 'utf8');

  // Fetch the SAME PNG your app uses (singular 'ticket')
  let ticketPngBase64: string | null = null;
  try {
    const baseUrl = (opts.appUrl ?? deriveBaseUrl(undefined)).replace(/\/$/, '');
    const pngRes = await fetch(
      `${baseUrl}/api/ticket/png?token=${encodeURIComponent(opts.token)}`,
      { cache: 'no-store' }
    );
    if (pngRes.ok) {
      ticketPngBase64 = Buffer.from(
        await pngRes.arrayBuffer()
      ).toString('base64');
    }
  } catch {
    // non-fatal
  }

  const attachments: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }> = [
    {
      filename: `${(opts.event as any).slug || 'event'}.ics`,
      content: ics.toString('base64'),
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    },
  ];

  if (ticketPngBase64) {
    attachments.push({
      filename: 'ticket.png',
      content: ticketPngBase64,
      contentType: 'image/png',
    });
  }

  if (opts.attachments?.length) {
    for (const a of opts.attachments) {
      attachments.push({
        filename: a.filename,
        content: a.content,
        contentType: a.type,
      });
    }
  }

  const from =
    process.env.EMAIL_FROM?.trim() ||
    'Invitation App <tickets@triggerdxb.com>';

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `${opts.event.title} — Your Ticket`,
    html,
    text: `Your ticket for ${opts.event.title}. Show the QR at the entrance. Token: ${opts.token}`,
    attachments,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw error;
  }
}
