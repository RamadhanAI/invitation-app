// lib/email.ts
// lib/email.ts
import sgMail from '@sendgrid/mail';
import QRCode from 'qrcode';
import { formatCents } from './currency';
import { prisma } from './db';
import { normalizeMeta, type AttendeeMeta } from './meta';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/** Branding passed/stored per organizer */
export type Brand = {
  emailFromName?: string;
  primary?: string;
  secondary?: string;
  button?: string;
  logoUrl?: string;
  [k: string]: unknown;
};

export type EventLite = {
  title: string;
  date?: Date | string | null;
  venue?: string | null;
  currency: string;
  price: number; // cents
};

// ---------- helpers ----------
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function normalizeBrand(val: unknown): Brand {
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Brand;
    } catch {
      /* ignore */
    }
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Brand;
  return {};
}

function icsForEvent(ev: EventLite, email?: string) {
  const start = ev.date ? new Date(ev.date) : null;
  const end = start ? new Date(start.getTime() + 2 * 60 * 60 * 1000) : null;
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
    end ? `DTEND:${ts(end)}` : '',
    `SUMMARY:${escapeHtml(ev.title)}`,
    ev.venue ? `LOCATION:${escapeHtml(ev.venue)}` : '',
    email ? `ATTENDEE:MAILTO:${email}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** HTML that mirrors the screenshot badge preview (QR + name + job + company + VISITOR) */
export function buildBadgeHTML(args: {
  brand: Brand;
  event: EventLite;
  token: string;
  meta: AttendeeMeta;
  appUrl?: string;
}) {
  const { brand, event, token, meta } = args;
  const primary = brand.primary ?? '#111827';
  const secondary = brand.secondary ?? '#9aa3af';
  const button = brand.button ?? '#2e5fff';

  const fullName = [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() || 'FULL NAME';
  const jobTitle = meta.jobTitle || 'JOB TITLE';
  const company = (meta.companyName ?? meta.company) || 'COMPANY NAME';
  const priceText = !event.price || event.price === 0 ? 'FREE' : formatCents(event.price, event.currency);
  const dateLine = event.date ? new Date(event.date).toLocaleString() : '';
  const venue = event.venue ? ` · ${event.venue}` : '';
  const ticketUrl = `${(args.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/t/${encodeURIComponent(
    token
  )}`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(17,24,39,.06);overflow:hidden;">
      ${
        brand.logoUrl
          ? `<tr><td style="padding:16px 20px;border-bottom:1px solid #eef1f6;">
               <img src="${escapeHtml(String(brand.logoUrl))}" alt="${escapeHtml(
              brand.emailFromName ?? 'Logo'
            )}" style="max-height:48px;display:block;">
             </td></tr>`
          : ''
      }

      <tr><td style="padding:24px 24px 0 24px;">
        <h1 style="margin:0;font-size:22px;line-height:28px;color:${primary};font-weight:700;">${escapeHtml(event.title)}</h1>
        <div style="margin-top:6px;color:${secondary};font-size:14px;line-height:20px;">
          ${escapeHtml(`${dateLine}${venue}`)}
          <span style="float:right;background:#eef1f6;color:#111827;border-radius:999px;padding:4px 10px;font-size:12px;">${escapeHtml(
            priceText
          )}</span>
        </div>
      </td></tr>

      <tr><td style="padding:20px 24px 28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:360px;background:#fff;border-radius:12px;border:1px solid #e7e9f1;margin:0 auto;">
          <tr><td style="background:linear-gradient(90deg,#2e5fff,#86efac);padding:12px 16px;border-top-left-radius:12px;border-top-right-radius:12px;">
            <div style="color:#fff;font-weight:700;letter-spacing:.4px;font-size:12px;">BADGE PREVIEW</div>
          </td></tr>

          <tr><td style="padding:16px 16px 8px 16px;text-align:center;">
            <img src="cid:ticket-qr" alt="QR Code" width="144" height="144" style="display:block;margin:0 auto;border-radius:8px;">
          </td></tr>

          <tr><td style="padding:0 16px 16px 16px;text-align:center;">
            <div style="font-size:16px;font-weight:800;color:#111827;margin:4px 0 2px;">${escapeHtml(fullName)}</div>
            <div style="font-size:14px;font-weight:700;color:${button};margin:0 0 2px;">${escapeHtml(jobTitle)}</div>
            <div style="font-size:13px;font-weight:600;color:#6b7280;margin:0 0 8px;">${escapeHtml(company)}</div>
          </td></tr>

          <tr><td style="padding:0 16px 16px 16px;">
            <div style="background:#233876;color:#fff;border-radius:10px;text-align:center;padding:14px 12px;font-weight:800;letter-spacing:1px;font-size:16px;box-shadow:0 4px 12px rgba(35,56,118,.25);">
              VISITOR
            </div>
          </td></tr>

          <tr><td style="padding:0 16px 20px 16px;">
            <div style="font-size:12px;color:#6b7280;line-height:18px;">
              <strong>Important:</strong> This is a preview of your badge information only. It is not valid for event entry.
            </div>
          </td></tr>
        </table>

        <div style="text-align:center;margin-top:20px;">
          <a href="${ticketUrl}" style="background:${button};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;display:inline-block;">
            Open Your Ticket
          </a>
          <div style="margin-top:8px;font-size:12px;color:#6b7280;">
            Your check-in token: <code style="background:#eef1f6;padding:2px 6px;border-radius:6px;">${escapeHtml(
              token.slice(0, 6)
            )}…${escapeHtml(token.slice(-6))}</code>
          </div>
        </div>
      </td></tr>
    </table>

    <div style="max-width:640px;margin-top:10px;text-align:center;color:#9aa3af;font-size:12px;">
      © ${new Date().getFullYear()} ${escapeHtml(brand.emailFromName || 'Your Events')}
    </div>
  </td></tr>
</table>`;
}

// ---------- email sender (overloaded) ----------
type LegacyArgs = { to: string; eventId: string; qrToken: string };
type V2Args = { to: string; brand: Brand; event: EventLite; token: string; meta: AttendeeMeta };

export async function sendRegistrationEmail(args: LegacyArgs): Promise<void>;
export async function sendRegistrationEmail(args: V2Args): Promise<void>;
export async function sendRegistrationEmail(args: LegacyArgs | V2Args): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) return;

  if ('eventId' in args) {
    // Legacy path: load event + brand + attendee meta
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

    await sendEmailInternal({
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
      fromName: brand.emailFromName || event.organizer?.name || 'Your Events',
    });
    return;
  }

  // V2 path
  await sendEmailInternal({
    to: args.to,
    brand: args.brand,
    event: args.event,
    token: args.token,
    meta: args.meta,
    fromName: args.brand.emailFromName || 'Your Events',
  });
}

async function sendEmailInternal(opts: {
  to: string;
  brand: Brand;
  event: EventLite;
  token: string;
  meta: AttendeeMeta;
  fromName: string;
}) {
  // Build HTML
  const html = buildBadgeHTML({ brand: opts.brand, event: opts.event, token: opts.token, meta: opts.meta });

  // QR as inline CID image
  const qrPng = await QRCode.toBuffer(opts.token, { width: 400, margin: 1 });

  // .ics calendar attachment
  const ics = Buffer.from(icsForEvent(opts.event, opts.to), 'utf8');

  await sgMail.send({
    to: opts.to,
    from: { email: 'noreply@your-verified-domain.com', name: opts.fromName },
    subject: `${opts.event.title} — Your Ticket`,
    html,
    text: `Your ticket for ${opts.event.title}. Show the QR at the entrance. Token: ${opts.token}`,
    attachments: [
      {
        content: qrPng.toString('base64'),
        filename: 'ticket-qr.png',
        type: 'image/png',
        disposition: 'inline',
        contentId: 'ticket-qr', // ✅ correct key
      },
      {
        content: ics.toString('base64'),
        filename: 'event.ics',
        type: 'text/calendar; charset=utf-8; method=PUBLISH',
        disposition: 'attachment',
      },
    ],
  });
}
