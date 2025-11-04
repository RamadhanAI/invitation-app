// lib/emailTemplate.ts
// lib/emailTemplate.ts
export type Brand = {
  emailFromName?: string;
  primary?: string;
  secondary?: string;
  button?: string;
  logoUrl?: string;
  sponsorLogoUrl?: string;
  [k: string]: unknown;
};

export type EventLite = {
  title: string;
  date?: Date | string | null;
  venue?: string | null;
  currency: string;
  price: number; // cents
  slug?: string;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]!
    )
  );
}

function formatCents(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format((cents || 0) / 100);
  } catch {
    return `${(cents || 0) / 100} ${currency}`;
  }
}

function normalizeRole(r?: string) {
  const up = (r || '').trim().toUpperCase();
  const ALLOW = new Set([
    'ATTENDEE',
    'SPEAKER',
    'VIP',
    'STAFF',
    'MEDIA',
    'EXHIBITOR',
    'SPONSOR',
  ]);
  return ALLOW.has(up) ? up : 'ATTENDEE';
}

/**
 * buildBadgeHTML
 * Cinematic black/gold email with embedded QR.
 */
export function buildBadgeHTML(args: {
  brand: Brand;
  event: EventLite;
  token: string;
  meta: Record<string, any>;
  appUrl?: string;
  qrDataUrl: string;
}) {
  const { brand, event, token, meta, qrDataUrl } = args;

  const primary   = brand.primary   ?? '#ffffff';
  const secondary = brand.secondary ?? 'rgba(255,255,255,.7)';
  const button    = brand.button    ?? 'linear-gradient(90deg,#FFE58A,#D4AF37 50%,#8B6B16)';
  const nowYear   = new Date().getFullYear();

  const fullName = [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim() || 'Guest';
  const jobTitle = (meta.jobTitle || '').toString().trim() || '';
  const company  = (meta.companyName || meta.company || '').toString().trim() || '';
  const role     = normalizeRole(meta.role);

  const priceText =
    !event.price || event.price === 0
      ? 'FREE'
      : formatCents(event.price, event.currency);

  const dateLine = event.date
    ? new Date(event.date as any).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const venueLine = event.venue ? ` · ${event.venue}` : '';

  const baseUrl = (args.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const ticketUrl = `${baseUrl}/t/${encodeURIComponent(token)}`;

  const shortRef = token.length > 14 ? `${token.slice(0, 6)}…${token.slice(-4)}` : token;

  return `
<table role="presentation" width="100%" cellPadding="0" cellSpacing="0"
       style="background:#0b0d10;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center" style="padding:12px;">
      <table role="presentation" width="640" cellPadding="0" cellSpacing="0"
             style="
               width:640px;max-width:640px;background:#0f141a;border-radius:16px;
               border:1px solid rgba(212,175,55,.3);
               box-shadow:0 30px 80px rgba(0,0,0,.8),0 0 120px rgba(212,175,55,.15);
               color:#fff;
               background-image:
                 radial-gradient(circle at 20% 0%,rgba(212,175,55,.22) 0%,rgba(0,0,0,0) 60%),
                 radial-gradient(circle at 80% 120%,rgba(212,175,55,.08) 0%,rgba(0,0,0,0) 70%);
               overflow:hidden;">
        <!-- HEADER -->
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid rgba(212,175,55,.25);">
            <table role="presentation" width="100%" style="width:100%;">
              <tr>
                <td style="vertical-align:top;">
                  <div style="
                    display:inline-block;font-size:12px;line-height:1;font-weight:600;color:#0b0d10;
                    background:linear-gradient(135deg,#FFE58A 0%,#D4AF37 40%,#8B6B16 100%);
                    border-radius:6px;box-shadow:0 12px 30px rgba(212,175,55,.45);
                    padding:6px 10px;text-shadow:0 1px 0 rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.4);">
                    ${escapeHtml(brand.emailFromName || 'Demo Events')}
                  </div>
                </td>
                <td style="vertical-align:top;text-align:right;">
                  ${
                    brand.logoUrl
                      ? `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.emailFromName || 'Logo')}"
                               style="max-height:40px;width:auto;height:auto;border-radius:4px;border:1px solid rgba(255,255,255,.08);box-shadow:0 8px 24px rgba(0,0,0,.8);" />`
                      : ''
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- EVENT META -->
        <tr>
          <td style="padding:20px 24px 0 24px;">
            <div style="font-size:20px;line-height:28px;font-weight:600;color:${primary};margin:0 0 4px 0;">
              ${escapeHtml(event.title)}
            </div>
            <div style="font-size:13px;line-height:18px;color:${secondary};">
              ${escapeHtml(`${dateLine}${venueLine}`)}
              <span style="
                display:inline-block;margin-left:8px;font-size:11px;font-weight:600;line-height:1;color:#0b0d10;
                background:linear-gradient(135deg,#FFE58A,#D4AF37 50%,#8B6B16);
                border-radius:999px;padding:4px 8px;border:1px solid rgba(255,255,255,.4);
                box-shadow:0 10px 24px rgba(212,175,55,.6);text-shadow:0 1px 0 rgba(0,0,0,.4);">
                ${escapeHtml(priceText)}
              </span>
            </div>
          </td>
        </tr>

        <!-- GOLD CARD BODY -->
        <tr>
          <td style="padding:24px;">
            <table role="presentation" style="
                     width:100%;max-width:400px;margin:0 auto;
                     background:radial-gradient(circle at 30% 10%,#3a2a00 0%,#000 70%);
                     background-color:#1a1200;border-radius:14px;border:1px solid rgba(255,255,255,.12);
                     box-shadow:0 25px 60px rgba(212,175,55,.4),0 2px 0 rgba(255,255,255,.2) inset;
                     color:#fff;font-size:14px;line-height:20px;">
              <tr>
                <td style="padding:16px 16px 12px 16px;border-bottom:1px solid rgba(255,255,255,.12);">
                  <table role="presentation" width="100%" style="width:100%;">
                    <tr>
                      <td style="font-size:13px;line-height:16px;font-weight:600;color:#fff;">
                        ${escapeHtml(event.title)}
                      </td>
                      <td style="text-align:right;">
                        <span style="
                          font-size:11px;line-height:1;font-weight:700;display:inline-block;color:#0b0d10;
                          background:linear-gradient(135deg,#FFE58A,#D4AF37 50%,#8B6B16);
                          border-radius:999px;padding:4px 8px;border:1px solid rgba(255,255,255,.4);
                          text-shadow:0 1px 0 rgba(0,0,0,.4);box-shadow:0 10px 24px rgba(212,175,55,.6);">
                          ${escapeHtml(role)}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:16px;">
                  <table role="presentation" width="100%" style="width:100%;">
                    <tr valign="top">
                      <td style="width:1%;white-space:nowrap;padding-right:12px;">
                        <div style="
                          background:#fff;border-radius:8px;border:1px solid rgba(0,0,0,.4);
                          box-shadow:0 12px 24px rgba(0,0,0,.9);padding:6px;width:120px;height:120px;">
                          <img src="${qrDataUrl}" alt="QR code"
                               width="108" height="108"
                               style="display:block;width:108px;height:108px;border-radius:4px;" />
                        </div>
                      </td>

                      <td style="font-size:13px;line-height:18px;color:#fff;">
                        <div style="font-weight:700;font-size:14px;line-height:20px;color:#fff;">
                          ${escapeHtml(fullName)}
                        </div>
                        ${ jobTitle ? `<div style="color:#9CA3AF;font-size:13px;font-weight:500;line-height:18px;">${escapeHtml(jobTitle)}</div>` : '' }
                        ${ company  ? `<div style="color:#E5E7EB;font-size:12px;font-weight:600;line-height:16px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(company)}</div>` : '<div style="height:8px;"></div>' }

                        <div style="font-size:11px;line-height:16px;color:#D1D5DB;word-break:break-word;max-width:200px;">
                          <strong style="color:#fff;">Important:</strong>
                          Bring this email and show staff this QR at the entrance. This email is your entry proof.
                          <br /><br />
                          Ref:
                          <code style="background:rgba(0,0,0,.6);border-radius:4px;padding:2px 4px;font-size:11px;color:#fff;border:1px solid rgba(255,255,255,.2);">${escapeHtml(shortRef)}</code>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:16px 16px 20px 16px;text-align:center;border-top:1px solid rgba(255,255,255,.12);">
                  <a href="${ticketUrl}"
                     style="display:inline-block;font-size:13px;line-height:18px;font-weight:700;text-decoration:none;color:#0b0d10;
                            background:${button};background-size:200% 200%;border-radius:10px;border:1px solid rgba(255,255,255,.4);
                            padding:10px 14px;box-shadow:0 16px 36px rgba(212,175,55,.55),0 1px 0 rgba(255,255,255,.5) inset;
                            text-shadow:0 1px 0 rgba(255,255,255,.3);">
                    View / Save Your Ticket
                  </a>
                  <div style="color:#A1A1AA;font-size:11px;line-height:16px;margin-top:10px;">
                    We’ve also attached your calendar invite (.ics) and a PNG ticket image (if available).
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:16px 24px 24px 24px;font-size:11px;line-height:16px;color:${secondary};text-align:center;border-top:1px solid rgba(212,175,55,.25);">
            © ${nowYear} ${escapeHtml(brand.emailFromName || 'Demo Events')}. All rights reserved.
          </td>
        </tr>
      </table>

      <div style="max-width:640px;margin-top:12px;color:#6b7280;font-size:11px;line-height:16px;text-align:center;">
        Trouble with the button? Copy &amp; paste this link:<br/>
        <span style="color:#9CA3AF;word-break:break-all;">${escapeHtml(ticketUrl)}</span>
      </div>
    </td>
  </tr>
</table>
`;
}
