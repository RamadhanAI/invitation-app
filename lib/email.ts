// lib/email.ts
// lib/email.ts
import QRCode from 'qrcode';
import { prisma } from './db';
import { normalizeMeta, type AttendeeMeta } from './meta';
import { buildBadgeHTML, type Brand, type EventLite } from './emailTemplate';
import type { BadgeConfig } from './badgeConfig';
import { badgeConfigToQuery, normalizeBrand } from './badgeConfig';

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
    const host = headers.get('x-forwarded-host') || headers.get('host');
    if (host) return `${proto}://${host}`;
  } catch {}
  return 'http://localhost:3000';
}

function normalizeBrandLocal(val: unknown): Brand {
  return normalizeBrand(val) as Brand;
}

function icsForEvent(ev: EventLite, email?: string) {
  const start = ev.date ? new Date(ev.date) : null;
  const end = start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null;
  const ts = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AurumPass//Ticket//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Math.random().toString(36).slice(2)}@aurumpass`,
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

const s = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);

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
    /** base64 string content */
    content: string;
    type?: string;
    disposition?: string;
    contentId?: string;
  }>;
  appUrl?: string;
  ticketUrl?: string;

  // ✅ optional: enforce consistent badge styling across email PNG URLs
  badgeConfig?: BadgeConfig;
  // ✅ optional: prebuilt urls from register route; if present, these win.
  frontPngUrl?: string;
  backPngUrl?: string;
  printUrl?: string;
};

export async function sendRegistrationEmail(args: LegacyArgs): Promise<void>;
export async function sendRegistrationEmail(args: V2Args): Promise<void>;
export async function sendRegistrationEmail(args: LegacyArgs | V2Args): Promise<void> {
  const resend = await getResend();
  if (!resend) return;

  if ('eventId' in args) {
    const event = await prisma.event.findUnique({
      where: { id: args.eventId },
      select: {
        title: true,
        price: true,
        currency: true,
        date: true,
        venue: true,
        slug: true,
        organizer: { select: { brand: true, name: true } },
      },
    });
    if (!event) return;

    const reg = await prisma.registration.findFirst({
      where: { eventId: args.eventId, email: args.to },
      select: { meta: true },
    });

    const brand = normalizeBrandLocal(event.organizer?.brand);
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
        slug: event.slug,
      },
      token: args.qrToken,
      meta,
      fromName: brand.emailFromName || event.organizer?.name || 'AurumPass',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      // no badgeConfig here unless you later resolve it using organizer brand defaults
    });
    return;
  }

  await sendEmailInternal(resend, {
    to: args.to,
    brand: args.brand,
    event: args.event,
    token: args.token,
    meta: args.meta,
    fromName: args.brand.emailFromName || 'AurumPass',
    attachments: args.attachments,
    appUrl: args.appUrl,
    badgeConfig: args.badgeConfig,
    frontPngUrl: args.frontPngUrl,
    backPngUrl: args.backPngUrl,
    printUrl: args.printUrl,
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
    attachments?: Array<{ filename: string; content: string; type?: string }>;
    appUrl?: string;

    badgeConfig?: BadgeConfig;
    frontPngUrl?: string;
    backPngUrl?: string;
    printUrl?: string;
  }
) {
  const base = baseFrom(opts.appUrl, undefined);
  const roleUpper = (s(opts.meta.role) || 'ATTENDEE').toUpperCase();

  const fullName =
    s((opts.meta as any).fullName) ||
    [s(opts.meta.firstName), s(opts.meta.lastName)].filter(Boolean).join(' ') ||
    opts.to;

  const jobTitle = s(opts.meta.jobTitle);
  const company = s(opts.meta.companyName) || s((opts.meta as any).company);
  const eventTitle = s(opts.event.title) || 'Event';

  const when = opts.event.date ? new Date(opts.event.date).toLocaleString() : '';
  const venue = s(opts.event.venue);
  const whenWhere = [when, venue].filter(Boolean).join(' · ');

  const bust = Date.now().toString();
  const badgeQs = badgeConfigToQuery(opts.badgeConfig);

  // Use provided URLs if passed (register route), otherwise build them here
  const frontPngUrl =
    opts.frontPngUrl ||
    `${base}/api/ticket/png?token=${encodeURIComponent(opts.token)}` +
      `&variant=front&width=1200&dpi=300&v=${bust}` +
      `&name=${encodeURIComponent(fullName)}` +
      `&title=${encodeURIComponent(jobTitle)}` +
      `&company=${encodeURIComponent(company)}` +
      `&label=${encodeURIComponent(roleUpper)}` +
      `&eventTitle=${encodeURIComponent(eventTitle)}` +
      `&eventTime=${encodeURIComponent(whenWhere)}` +
      badgeQs;

  const backPngUrl =
    opts.backPngUrl ||
    `${base}/api/ticket/png?token=${encodeURIComponent(opts.token)}` +
      `&variant=back&width=1200&dpi=300&v=${bust}` +
      badgeQs;

  const printUrl = opts.printUrl || `${base}/t/${encodeURIComponent(opts.token)}/print`;

  const qrDataUrl = await QRCode.toDataURL(opts.token, { width: 400, margin: 1 });

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

  // ICS (base64)
  const icsBase64 = Buffer.from(icsForEvent(opts.event, opts.to), 'utf8').toString('base64');

  // Try to attach the FRONT badge PNG; fallback to QR image if it fails
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

  const attachments: Array<{ filename: string; content: string; contentType?: string }> = [
    {
      filename: `${(opts.event as any).slug || 'event'}.ics`,
      content: icsBase64,
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    },
  ];

  if (ticketPngBase64) {
    attachments.push({ filename: 'ticket.png', content: ticketPngBase64, contentType: 'image/png' });
  }

  if (opts.attachments?.length) {
    for (const a of opts.attachments) {
      attachments.push({ filename: a.filename, content: a.content, contentType: a.type });
    }
  }

  const from =
    process.env.EMAIL_FROM?.trim() || `${opts.brand.emailFromName || 'AurumPass'} <tickets@triggerdxb.com>`;

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

// ----------------------------------------------------------
// Tenant onboarding emails
// ----------------------------------------------------------

export async function sendTenantInviteEmail(args: {
  to: string;
  inviteUrl: string;
  organizerName?: string;
}) {
  const resend = await getResend();
  if (!resend) return;

  const org = (args.organizerName || 'your organization').trim();

  await resend.emails.send({
    from: process.env.EMAIL_FROM?.trim() || `AurumPass <no-reply@triggerdxb.com>`,
    to: args.to,
    subject: `Your AurumPass tenant admin access (${org})`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;line-height:1.45">
        <h2 style="margin:0 0 12px">Set your password</h2>
        <p style="margin:0 0 12px">You have been invited as an admin for <b>${escapeHtml(org)}</b>.</p>
        <p style="margin:0 0 16px">Click the button below to set your password (link expires in 7 days):</p>
        <p style="margin:0 0 16px">
          <a href="${escapeHtml(args.inviteUrl)}" style="display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:10px">Set Password</a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:12px">If you didn’t request this, you can ignore this email.</p>
      </div>
    `,
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
