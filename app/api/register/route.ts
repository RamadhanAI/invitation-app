// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Dynamic optional modules (loose-typed on purpose) ---------- */

type AnyFn = (...args: any[]) => any;

type RateLimitModule = {
  rateLimit: AnyFn;
  ipKey: AnyFn;
};
type EmailModule = {
  sendRegistrationEmail: AnyFn;
};
type TokensModule = {
  signTicket: AnyFn;
  verifyTicket: AnyFn;
};
type MetaModule = {
  normalizeMeta: AnyFn;
};
type IcsModule = {
  buildIcs: AnyFn;
};

const loaders = {
  rateLimit: () => import('@/lib/rateLimit') as Promise<RateLimitModule>,
  email: () => import('@/lib/email') as Promise<EmailModule>,
  tokens: () => import('@/lib/tokens') as Promise<TokensModule>,
  meta: () => import('@/lib/meta') as Promise<MetaModule>,
  ics: () => import('@/lib/ics') as Promise<IcsModule>,
} as const;

async function tryLoad<K extends keyof typeof loaders>(
  key: K
): Promise<Awaited<ReturnType<(typeof loaders)[K]>> | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - dynamic module shape is intentionally loose
    return await loaders[key]();
  } catch {
    return null;
  }
}

const genToken = (bytes = 18) => crypto.randomBytes(bytes).toString('base64url');

function ok(data: any, init: ResponseInit = {}) {
  return NextResponse.json({ ok: true, ...data }, init);
}
function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function originFrom(req: Request) {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (base) return base.replace(/\/+$/, '');
  return forwardedHost ? `${proto}://${forwardedHost}` : '';
}

/* ----------------------- Optional captcha checker ---------------------- */
async function verifyCaptchaIfEnabled(captchaToken: string | undefined, ip: string) {
  const hSecret = process.env.HCAPTCHA_SECRET;
  const gSecret = process.env.RECAPTCHA_SECRET;
  if (!hSecret && !gSecret) return { ok: true as const };
  if (!captchaToken) return { ok: false as const, error: 'Captcha required' };
  try {
    if (hSecret) {
      const form = new URLSearchParams({ secret: hSecret, response: captchaToken, remoteip: ip });
      const r = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        cache: 'no-store',
      });
      const json = (await r.json()) as { success?: boolean };
      return json.success ? { ok: true as const } : { ok: false as const, error: 'Captcha failed' };
    }
    if (gSecret) {
      const form = new URLSearchParams({ secret: gSecret, response: captchaToken, remoteip: ip });
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        cache: 'no-store',
      });
      const json = (await r.json()) as { success?: boolean };
      return json.success ? { ok: true as const } : { ok: false as const, error: 'Captcha failed' };
    }
  } catch {
    return { ok: false as const, error: 'Captcha verification error' };
  }
  return { ok: true as const };
}

function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0]?.trim() || '0.0.0.0';
}

/* ------------------------------ Route ------------------------------ */
export async function POST(req: Request) {
  try {
    const rate = await tryLoad('rateLimit');
    const email = await tryLoad('email');
    const tokens = await tryLoad('tokens');
    const metaUtil = await tryLoad('meta');
    const icsUtil = await tryLoad('ics');

    // Rate limit (optional)
    if (rate?.rateLimit && rate?.ipKey) {
      const rl = rate.rateLimit({
        key: rate.ipKey(req, 'register'),
        limit: 5,
        windowMs: 60_000,
      }) as { ok: boolean };
      if (!rl.ok) return err(429, 'Too many attempts. Try again in a minute.');
    }

    // Parse body
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      slug?: string;
      eventSlug?: string;
      meta?: unknown;
      captchaToken?: string;
    };

    const emailRaw = body.email;
    const slug = body.slug || body.eventSlug;
    const meta = typeof body.meta === 'object' || typeof body.meta === 'string' ? body.meta : {};
    const captchaToken = body.captchaToken;

    if (!emailRaw || !slug) return err(400, 'Missing email or slug');

    // Optional captcha
    const cap = await verifyCaptchaIfEnabled(captchaToken, clientIp(req));
    if (!cap.ok) return err(400, cap.error || 'Captcha failed');

    // Load event
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        price: true,
        currency: true,
        venue: true,
        capacity: true,
        organizer: { select: { brand: true } },
      },
    });
    if (!event) return err(404, 'Event not found');

    // Capacity gate
    if (event.capacity && event.capacity > 0) {
      const total = await prisma.registration.count({ where: { eventId: event.id } });
      if (total >= event.capacity) return err(409, 'Registration is full for this event.');
    }

    const normEmail = emailRaw.trim().toLowerCase();

    // Idempotent by (eventId,email)
    let registration = await prisma.registration.findUnique({
      where: { eventId_email: { eventId: event.id, email: normEmail } },
      select: { id: true, email: true, paid: true, qrToken: true, meta: true },
    });

    if (!registration) {
      registration = await prisma.registration.create({
        data: {
          eventId: event.id,
          email: normEmail,
          price: event.price ?? 0,
          paid: (event.price ?? 0) === 0,
          qrToken: genToken(),
          meta: typeof meta === 'string' ? meta : (meta as object),
        },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });
    } else if (meta && typeof meta === 'object') {
      // Merge any new meta keys on repeat submissions (handle legacy string)
      const existing =
        (typeof registration.meta === 'string'
          ? (() => {
              try {
                return JSON.parse(registration.meta as any);
              } catch {
                return {};
              }
            })()
          : (registration.meta as any)) || {};
      const merged = { ...existing, ...(meta as any) };
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: { meta: merged },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });
    }

    // Upgrade to JWT token if configured
    if (process.env.TICKET_JWT_SECRET && tokens?.signTicket && tokens?.verifyTicket) {
      const valid = !!tokens.verifyTicket(registration.qrToken);
      if (!valid) {
        const jwtToken = tokens.signTicket({
          sub: registration.id,
          eventId: event.id,
          email: registration.email,
        }) as string;
        await prisma.registration.update({
          where: { id: registration.id },
          data: { qrToken: jwtToken },
        });
        registration.qrToken = jwtToken;
      }
    }

    // Normalize meta for email/template
    const normMeta =
      (metaUtil?.normalizeMeta?.(registration.meta) as any) ??
      ((registration.meta as any) ?? {});
    const reqMeta = (metaUtil?.normalizeMeta?.(meta) as any) ?? ((meta as any) ?? {});
    const finalMeta = {
      firstName: normMeta.firstName ?? reqMeta.firstName,
      lastName: normMeta.lastName ?? reqMeta.lastName,
      jobTitle: normMeta.jobTitle ?? reqMeta.jobTitle,
      companyName:
        normMeta.companyName ??
        reqMeta.companyName ??
        normMeta.company ??
        reqMeta.company,
      // ensure a non-VISITOR default
      role: normMeta.role ?? reqMeta.role ?? 'ATTENDEE',
    };

    // Optional ICS (kept for attachments)
    const base = originFrom(req);
    let icsStr = '';
    if (icsUtil?.buildIcs) {
      icsStr = icsUtil.buildIcs({
        title: event.title,
        start: new Date(event.date ?? Date.now()),
        end: event.date ? new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000) : undefined,
        location: event.venue ?? '',
        url: `${base}/e/${event.slug}`,
      }) as string;
    } else {
      const dt = new Date(event.date ?? Date.now())
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';
      icsStr = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${dt}
URL:${base}/e/${event.slug}
END:VEVENT
END:VCALENDAR`;
    }
    const attachments = [
      {
        content: Buffer.from(icsStr).toString('base64'),
        filename: `${event.slug}.ics`,
        type: 'text/calendar; charset=utf-8; method=PUBLISH',
        disposition: 'attachment',
      },
    ];

    // Email (optional + non-blocking)
    if (email?.sendRegistrationEmail) {
      const brand = (event.organizer?.brand ?? {}) as any;
      email
        .sendRegistrationEmail({
          to: registration.email,
          brand,
          event: {
            title: event.title,
            date: event.date ?? undefined,
            venue: event.venue ?? undefined,
            currency: event.currency,
            price: event.price,
            slug: event.slug,
          },
          token: registration.qrToken,
          meta: finalMeta,
          attachments,
          appUrl: base, // allows lib/email to call /api/ticket/png
        })
        .catch(() => {});
    }

    // Return both a page URL and a PNG URL
    const ticketPageUrl = `${base}/t/${encodeURIComponent(registration.qrToken)}`;
    const ticketPngUrl = `${base}/api/ticket/png?token=${encodeURIComponent(registration.qrToken)}`;

    return ok({
      registration: {
        ...registration,
        ticketUrl: ticketPageUrl,
        ticketPngUrl,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[register] error:', e);
    return err(500, 'Internal error');
  }
}
