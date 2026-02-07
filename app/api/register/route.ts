// app/api/register/route.ts
// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { resolveBadgeConfig, badgeConfigToQuery, normalizeBrand } from '@/lib/badgeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Optional module types (intentionally minimal) ---------- */
type AnyFn = (...args: any[]) => any;

type RateLimitModule = { rateLimit: AnyFn; ipKey: AnyFn };
type EmailModule = { sendRegistrationEmail: AnyFn };
type TokensModule = { signTicket: AnyFn; verifyTicket: AnyFn; isLikelyJwt?: AnyFn };
type MetaModule = { normalizeMeta: AnyFn };
type IcsModule = { buildIcs: AnyFn };

/* ---------- Per-key module map + loaders with exact types ---------- */
type ModuleMap = { rateLimit: RateLimitModule; email: EmailModule; tokens: TokensModule; meta: MetaModule; ics: IcsModule };

const loaders: { [K in keyof ModuleMap]: () => Promise<ModuleMap[K]> } = {
  rateLimit: () => import('@/lib/rateLimit') as Promise<RateLimitModule>,
  email: () => import('@/lib/email') as Promise<EmailModule>,
  tokens: () => import('@/lib/tokens') as Promise<TokensModule>,
  meta: () => import('@/lib/meta') as Promise<MetaModule>,
  ics: () => import('@/lib/ics') as Promise<IcsModule>,
};

/* Overloads keep inference precise */
async function tryLoad(key: 'rateLimit'): Promise<RateLimitModule | null>;
async function tryLoad(key: 'email'): Promise<EmailModule | null>;
async function tryLoad(key: 'tokens'): Promise<TokensModule | null>;
async function tryLoad(key: 'meta'): Promise<MetaModule | null>;
async function tryLoad(key: 'ics'): Promise<IcsModule | null>;
async function tryLoad<K extends keyof ModuleMap>(key: K): Promise<ModuleMap[K] | null> {
  try {
    return await loaders[key]();
  } catch {
    return null;
  }
}

/* ---------- Small helpers ---------- */
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

function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0]?.trim() || '0.0.0.0';
}

function s(v: unknown, d = '') {
  return typeof v === 'string' ? v.trim() : d;
}

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function normJson(v: unknown): Record<string, any> {
  try {
    if (!v) return {};
    if (typeof v === 'string') return JSON.parse(v);
    if (isObj(v)) return v;
    return {};
  } catch {
    return {};
  }
}

function normalizeRole(r?: string) {
  const up = (r || '').trim().toUpperCase();
  const ALLOW = new Set(['ATTENDEE', 'VIP', 'SPEAKER', 'STAFF', 'MEDIA', 'EXHIBITOR', 'SPONSOR']);
  return ALLOW.has(up) ? up : 'ATTENDEE';
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

/* ------------------------------ Route ------------------------------ */
export async function POST(req: Request) {
  try {
    const rate = await tryLoad('rateLimit');
    const emailMod = await tryLoad('email');
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

    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      slug?: string;
      eventSlug?: string;
      meta?: unknown;
      captchaToken?: string;
    };

    const emailRaw = body.email;
    const slug = body.slug || body.eventSlug;
    const rawMeta = body.meta;
    const captchaToken = body.captchaToken;

    if (!emailRaw || !slug) return err(400, 'Missing email or slug');

    // Optional captcha
    const cap = await verifyCaptchaIfEnabled(captchaToken, clientIp(req));
    if (!cap.ok) return err(400, cap.error || 'Captcha failed');

    // Load event + organizer brand
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
        organizer: { select: { brand: true, name: true } },
      },
    });
    if (!event) return err(404, 'Event not found');

    // Capacity gate
    if (event.capacity && event.capacity > 0) {
      const total = await prisma.registration.count({ where: { eventId: event.id } });
      if (total >= event.capacity) return err(409, 'Registration is full for this event.');
    }

    const normEmail = emailRaw.trim().toLowerCase();

    // Normalize incoming meta
    const reqMeta0 =
      (metaUtil?.normalizeMeta?.(rawMeta) as any) ??
      (typeof rawMeta === 'string' ? normJson(rawMeta) : (rawMeta as any)) ??
      {};
    const reqMeta = isObj(reqMeta0) ? reqMeta0 : {};

    // ✅ Resolve badge config per organizer (default + per-event override) + optional request override (meta.badge)
    const brandObj = normalizeBrand(event.organizer?.brand);
    const badgeCfg = resolveBadgeConfig({
      organizerBrand: brandObj,
      eventSlug: event.slug,
      requestBadgeOverride: reqMeta.badge, // optional
    });

    // Store a stable snapshot into registration.meta.badge
    const role = normalizeRole(s(reqMeta.role, 'ATTENDEE'));
    const mergedMeta: Record<string, any> = {
      ...reqMeta,
      role,
      badge: badgeCfg,
    };

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
          meta: mergedMeta,
        },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });
    } else {
      const existing = normJson(registration.meta);
      const nextMeta = { ...existing, ...reqMeta, role, badge: badgeCfg };
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: { meta: nextMeta },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });
    }

    // Upgrade to JWT token if configured (safe)
    if (process.env.TICKET_JWT_SECRET && tokens?.signTicket && tokens?.verifyTicket) {
      const looksJwt = (() => {
        try {
          if (typeof tokens.isLikelyJwt === 'function') return !!tokens.isLikelyJwt(registration.qrToken);
          return registration.qrToken.split('.').length === 3;
        } catch {
          return false;
        }
      })();

      let isValidJwt = false;
      if (looksJwt) {
        try {
          isValidJwt = !!tokens.verifyTicket(registration.qrToken);
        } catch {
          isValidJwt = false;
        }
      }

      if (!isValidJwt) {
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

    // Normalize meta for rendering/email
    const storedMeta0 = (metaUtil?.normalizeMeta?.(registration.meta) as any) ?? normJson(registration.meta);
    const storedMeta = isObj(storedMeta0) ? storedMeta0 : {};
    storedMeta.role = normalizeRole(s(storedMeta.role, role));
    storedMeta.badge = badgeCfg;

    const first = s(storedMeta.firstName);
const last = s(storedMeta.lastName);
const baseName = [first, last].filter(Boolean).join(' ').trim();

const badgeName = s(storedMeta.badgeName);
const title = s(storedMeta.title);

// Rule:
// 1) If badgeName exists, use it exactly (don’t auto-prefix title).
// 2) Else use [title + baseName] if available.
// 3) Else fallback to baseName or email.
const fullName =
  badgeName ||
  [title, baseName].filter(Boolean).join(' ').trim() ||
  baseName ||
  registration.email;

    const jobTitle = s(storedMeta.jobTitle);
    const company = s(storedMeta.companyName) || s(storedMeta.company);

    const eventTitle = event.title ?? 'Event';
    const when = event.date ? new Date(event.date).toLocaleString() : '';
    const venue = event.venue ?? '';
    const whenWhere = [when, venue].filter(Boolean).join(' · ');

    const base = originFrom(req);
    const bust = Date.now().toString();
    const badgeQs = badgeConfigToQuery(badgeCfg);

    const ticketPngFrontUrl =
      `${base}/api/ticket/png?token=${encodeURIComponent(registration.qrToken)}` +
      `&variant=front&width=1200&dpi=300&v=${bust}` +
      `&name=${encodeURIComponent(fullName)}` +
      `&title=${encodeURIComponent(jobTitle)}` +
      `&company=${encodeURIComponent(company)}` +
      `&label=${encodeURIComponent(storedMeta.role)}` +
      `&eventTitle=${encodeURIComponent(eventTitle)}` +
      `&eventTime=${encodeURIComponent(whenWhere)}` +
      badgeQs;

    const ticketPngBackUrl =
      `${base}/api/ticket/png?token=${encodeURIComponent(registration.qrToken)}` +
      `&variant=back&width=1200&dpi=300&v=${bust}` +
      badgeQs;

    const printUrl = `${base}/t/${encodeURIComponent(registration.qrToken)}/print`;

    // Optional ICS (kept for attachments)
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
      const dt = new Date(event.date ?? Date.now()).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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
    if (emailMod?.sendRegistrationEmail) {
      emailMod
        .sendRegistrationEmail({
          to: registration.email,
          brand: brandObj, // organizer.brand JSON (already normalized)
          event: {
            title: event.title,
            date: event.date ?? undefined,
            venue: event.venue ?? undefined,
            currency: event.currency,
            price: event.price,
            slug: event.slug,
          },
          token: registration.qrToken,
          meta: storedMeta,
          attachments,
          frontPngUrl: ticketPngFrontUrl,
          backPngUrl: ticketPngBackUrl,
          printUrl,
          appUrl: base,
          // optional if your email.ts supports it:
          badgeConfig: badgeCfg,
        })
        .catch(() => {});
    }

    const ticketPageUrl = `${base}/t/${encodeURIComponent(registration.qrToken)}/print`;

    return ok({
      registration: {
        ...registration,
        ticketUrl: ticketPageUrl,
        ticketPngUrl: ticketPngFrontUrl,
        ticketPngFrontUrl,
        ticketPngBackUrl,
        printUrl,
      },
    });
  } catch (e) {
    console.error('[register] error:', e);
    return err(500, 'Internal error');
  }
}
