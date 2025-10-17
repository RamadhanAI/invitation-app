// app/api/register/route.ts
// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Optional dependency loaders (graceful fallbacks) ---------- */
async function safeImport<T>(path: string): Promise<Partial<T> | null> {
  try { return (await import(path)) as any; } catch { return null; }
}
const genToken = (bytes = 18) => crypto.randomBytes(bytes).toString('base64url');

function ok(data: any, init: ResponseInit = {}) { return NextResponse.json({ ok: true, ...data }, init); }
function err(status: number, message: string) { return NextResponse.json({ ok: false, error: message }, { status }); }

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
  if (!hSecret && !gSecret) return { ok: true };
  if (!captchaToken) return { ok: false, error: 'Captcha required' };
  try {
    if (hSecret) {
      const form = new URLSearchParams({ secret: hSecret, response: captchaToken, remoteip: ip });
      const r = await fetch('https://hcaptcha.com/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString(), cache: 'no-store' });
      const json = await r.json(); return json.success ? { ok: true } : { ok: false, error: 'Captcha failed' };
    }
    if (gSecret) {
      const form = new URLSearchParams({ secret: gSecret, response: captchaToken, remoteip: ip });
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString(), cache: 'no-store' });
      const json = await r.json(); return json.success ? { ok: true } : { ok: false, error: 'Captcha failed' };
    }
  } catch {
    return { ok: false, error: 'Captcha verification error' };
  }
  return { ok: true };
}

function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0].trim() || '0.0.0.0';
}

/* ------------------------------ Route ------------------------------ */
export async function POST(req: Request) {
  try {
    // Load optional modules
    const rate = await safeImport<{ rateLimit: Function; ipKey: Function }>('@/lib/rateLimit');
    const email = await safeImport<{ sendRegistrationEmail: Function }>('@/lib/email');
    const tokens = await safeImport<{ signTicket: Function; verifyTicket: Function }>('@/lib/tokens');
    const metaUtil = await safeImport<{ normalizeMeta: (x: any) => any }>('@@/lib/meta').catch(() => null) || await safeImport<{ normalizeMeta: (x: any) => any }>('@/lib/meta');
    const icsUtil = await safeImport<{ buildIcs: Function }>('@/lib/ics');

    // Rate limit (optional)
    if (rate?.rateLimit && rate?.ipKey) {
      const rl = (rate.rateLimit as any)({ key: (rate.ipKey as any)(req, 'register'), limit: 5, windowMs: 60_000 });
      if (!rl.ok) return err(429, 'Too many attempts. Try again in a minute.');
    }

    // Parse body (support `slug` and `eventSlug`)
    const body = await req.json().catch(() => ({} as any));
    const emailRaw: string | undefined = body.email;
    const slug: string | undefined = body.slug || body.eventSlug;
    const meta = (typeof body.meta === 'object' || typeof body.meta === 'string') ? body.meta : {};
    const captchaToken: string | undefined = body.captchaToken;

    if (!emailRaw || !slug) return err(400, 'Missing email or slug');

    // Optional captcha
    const cap = await verifyCaptchaIfEnabled(captchaToken, clientIp(req));
    if (!cap.ok) return err(400, cap.error || 'Captcha failed');

    // Load event
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, title: true, date: true, price: true, currency: true, venue: true, capacity: true,
        organizer: { select: { brand: true } },
      },
    });
    if (!event) return err(404, 'Event not found');

    // Capacity
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
      // Merge any new meta keys on repeat submissions
      const existing = (registration.meta as any) || {};
      const merged = { ...existing, ...(meta as any) };
      registration = await prisma.registration.update({
        where: { id: registration.id },
        data: { meta: merged },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });
    }

    // Upgrade to JWT token if configured & helpers present
    if (process.env.TICKET_JWT_SECRET && tokens?.signTicket && tokens?.verifyTicket) {
      const valid = (tokens.verifyTicket as any)(registration.qrToken);
      if (!valid) {
        const jwtToken = (tokens.signTicket as any)({ sub: registration.id, eventId: event.id, email: registration.email });
        await prisma.registration.update({ where: { id: registration.id }, data: { qrToken: jwtToken } });
        registration.qrToken = jwtToken;
      }
    }

    // Normalize meta for email template (optional util)
    const normMeta = (metaUtil?.normalizeMeta as any)?.(registration.meta) ?? (registration.meta as any) ?? {};
    const reqMeta  = (metaUtil?.normalizeMeta as any)?.(meta) ?? (meta as any) ?? {};
    const finalMeta = {
      firstName: normMeta.firstName ?? reqMeta.firstName,
      lastName:  normMeta.lastName  ?? reqMeta.lastName,
      jobTitle:  normMeta.jobTitle  ?? reqMeta.jobTitle,
      companyName: normMeta.companyName ?? reqMeta.companyName ?? normMeta.company ?? reqMeta.company,
    };

    // ICS (fallback to minimal if helper missing)
    let icsStr = '';
    if (icsUtil?.buildIcs) {
      icsStr = (icsUtil.buildIcs as any)({
        title: event.title,
        start: new Date(event.date ?? Date.now()),
        end: event.date ? new Date(new Date(event.date).getTime() + 2 * 60 * 60 * 1000) : undefined,
        location: event.venue ?? '',
        url: `${originFrom(req)}/e/${event.slug}`,
      });
    } else {
      const dt = new Date(event.date ?? Date.now()).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsStr = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${dt}\nURL:${originFrom(req)}/e/${event.slug}\nEND:VEVENT\nEND:VCALENDAR`;
    }
    const attachments = [{
      content: Buffer.from(icsStr).toString('base64'),
      filename: `${event.slug}.ics`,
      type: 'text/calendar',
      disposition: 'attachment',
    }];

    // Email (optional)
    if (email?.sendRegistrationEmail) {
      const brand = (event.organizer?.brand ?? {}) as any;
      const ticketUrl = `${originFrom(req)}/api/tickets/${encodeURIComponent(registration.qrToken)}`;
      (email.sendRegistrationEmail as any)({
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
        ticketUrl,
      }).catch(() => {}); // never block on email failures
    }

    const ticketUrl = `${originFrom(req)}/api/tickets/${encodeURIComponent(registration.qrToken)}`;
    return ok({ registration: { ...registration, ticketUrl } });
  } catch (e) {
    console.error('[register] error:', e);
    return err(500, 'Internal error');
  }
}
