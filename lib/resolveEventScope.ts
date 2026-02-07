// lib/resolveEventScope.ts
// lib/resolveEventScope.ts
import 'server-only';

import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export type ResolveOk = {
  ok: true;
  eventId: string;
  organizerId: string;
  mode: 'session' | 'key';
};

export type ResolveFail = { ok: false; status: number; error: string };

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    const s = (v || '').trim();
    if (s) return s;
  }
  return '';
}

export async function resolveEventScope(req: Request, slug: string): Promise<ResolveOk | ResolveFail> {
  // 1) Prefer admin session (web UI)
  const sess = getAdminSession();

  if (sess) {
    const isSuper = sess.role === 'superadmin';

    // For tenant roles, oid is the tenant boundary.
    // If missing, treat as unauthorized (prevents cross-tenant leakage).
    if (!isSuper && !sess.oid) {
      return { ok: false, status: 401, error: 'No organizer scope' };
    }

    const event = await prisma.event.findFirst({
      where: isSuper ? { slug } : { slug, organizerId: sess.oid! },
      select: { id: true, organizerId: true },
    });

    if (!event) return { ok: false, status: 404, error: 'Event not found' };
    if (!event.organizerId) return { ok: false, status: 500, error: 'Event has no organizerId' };

    return { ok: true, eventId: event.id, organizerId: event.organizerId, mode: 'session' };
  }

  // 2) Optional fallback for machine keys (keep only if you truly need it)
  const headerKey = req.headers.get('x-api-key');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const cookieKey = cookies().get('admin_key')?.value;
  const urlKey = new URL(req.url).searchParams.get('key');

  const provided = firstNonEmpty(headerKey, bearer, cookieKey, urlKey);

  // If no key was provided at all, fail fast (avoid DB work)
  if (!provided) return { ok: false, status: 401, error: 'Unauthorized' };

  const admin = firstNonEmpty(process.env.ADMIN_KEY, process.env.NEXT_PUBLIC_ADMIN_KEY);

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizerId: true },
  });

  if (!event) return { ok: false, status: 404, error: 'Event not found' };
  if (!event.organizerId) return { ok: false, status: 500, error: 'Event has no organizerId' };

  // Fetch organizer.apiKey without relying on Prisma relation field
  const org = await prisma.organizer.findUnique({
    where: { id: event.organizerId },
    select: { apiKey: true },
  });

  const orgKey = (org?.apiKey || '').trim();

  const ok =
    (admin && safeEqual(provided, admin)) ||
    (orgKey && safeEqual(provided, orgKey));

  if (!ok) return { ok: false, status: 401, error: 'Unauthorized' };

  return { ok: true, eventId: event.id, organizerId: event.organizerId, mode: 'key' };
}
