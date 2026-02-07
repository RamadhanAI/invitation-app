// app/api/admin/brand/badge/route.ts
// app/api/admin/brand/badge/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { sanitizeBadge } from '@/lib/badgeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function ok(data: any, init: ResponseInit = {}) {
  return NextResponse.json({ ok: true, ...data }, init);
}

function asObj(v: unknown): Record<string, any> {
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as any;
    } catch {}
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as any;
  return {};
}

/**
 * PATCH /api/admin/brand/badge
 * Body:
 * - { scope: "default", organizerId?, badge }
 * - { scope: "event", organizerId?, eventSlug, badge }
 *
 * Rules:
 * - superadmin can edit any organizer by passing organizerId
 * - tenant admin edits their own organizer only (organizerId ignored)
 * - badge is sanitized via lib/badgeConfig.ts (hex/bg/template/https urls)
 * - stored at:
 *   - brand.badge (default)
 *   - brand.events[eventSlug].badge (per-event override)
 */
export async function PATCH(req: Request) {
  const sess = getAdminSession();
  if (!sess) return err(401, 'Unauthorized');

  const body = (await req.json().catch(() => ({}))) as any;

  const scope = String(body.scope || 'event'); // "event" | "default"
  const eventSlug = body.eventSlug ? String(body.eventSlug).trim() : '';

  const isSuper = sess.role === 'superadmin';
  const organizerId = isSuper ? String(body.organizerId || sess.oid || '').trim() : String(sess.oid || '').trim();

  if (!organizerId) return err(400, 'No organizer scope');
  if (scope === 'event' && !eventSlug) return err(400, 'Missing eventSlug');

  // sanitize badge config using shared rules
  const badge = sanitizeBadge(body.badge);

  const org = await prisma.organizer.findUnique({
    where: { id: organizerId },
    select: { id: true, brand: true },
  });
  if (!org) return err(404, 'Organizer not found');

  const brand = asObj(org.brand);

  if (scope === 'default') {
    brand.badge = badge;
  } else {
    if (!brand.events || typeof brand.events !== 'object' || Array.isArray(brand.events)) brand.events = {};
    if (!brand.events[eventSlug] || typeof brand.events[eventSlug] !== 'object' || Array.isArray(brand.events[eventSlug])) {
      brand.events[eventSlug] = {};
    }
    brand.events[eventSlug].badge = badge;
  }

  await prisma.organizer.update({
    where: { id: organizerId },
    data: { brand },
  });

  return ok({ scope, eventSlug: scope === 'event' ? eventSlug : null, badge });
}
