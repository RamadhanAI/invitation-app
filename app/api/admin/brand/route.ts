// app/api/admin/brand/route.ts
// app/api/admin/brand/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sanitizeBadge } from '@/lib/badgeConfig';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
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

function mergeBrand(prev: unknown, patch: Record<string, any>) {
  const base = asObj(prev);
  return { ...base, ...patch };
}

function getAuth() {
  const sess = getAdminSession();
  if (!sess) return { ok: false as const, status: 401 as const, error: 'Unauthorized' };
  // getAdminSession() already blocks scanner role + enforces oid for non-superadmin
  const isSuper = sess.role === 'superadmin';
  const oid = sess.oid || null; // superadmin may be null unless impersonating
  return { ok: true as const, sess, isSuper, oid };
}

/**
 * Resolve target organizer for read/write.
 * - Tenant: always sess.oid
 * - Superadmin:
 *    - if impersonating (sess.oid present) and organizerId missing => use sess.oid
 *    - else require organizerId for read/write
 */
function resolveTargetOrgId({
  isSuper,
  oid,
  organizerIdFromBody,
  organizerIdFromQuery,
  requireExplicitForSuper,
}: {
  isSuper: boolean;
  oid: string | null;
  organizerIdFromBody?: string | null;
  organizerIdFromQuery?: string | null;
  requireExplicitForSuper: boolean;
}) {
  const bodyId = (organizerIdFromBody || '').trim();
  const queryId = (organizerIdFromQuery || '').trim();

  if (!isSuper) return oid; // tenant must have oid already

  // Superadmin:
  const explicit = bodyId || queryId;
  if (explicit) return explicit;

  // If superadmin is impersonating, allow implicit oid target
  if (oid) return oid;

  // Otherwise, superadmin must specify organizerId (avoid accidental updates to “first organizer”)
  if (requireExplicitForSuper) return null;

  // For list endpoints we might not need a target
  return null;
}

// ------------------------------------------------------------
// GET:
// - Superadmin:
//    - /api/admin/brand -> list organizers
//    - /api/admin/brand?organizerId=... -> brand + events for that organizer
// - Tenant:
//    - /api/admin/brand -> brand + events for own organizer (sess.oid)
// ------------------------------------------------------------
export async function GET(req: Request) {
  const auth = getAuth();
  if (!auth.ok) return err(auth.status, auth.error);

  const url = new URL(req.url);
  const organizerId = (url.searchParams.get('organizerId') || '').trim();

  // Superadmin list mode
  if (auth.isSuper && !organizerId && !auth.oid) {
    const organizers = await prisma.organizer.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, name: true, email: true, status: true, createdAt: true },
      take: 100,
    });
    return ok({ organizers });
  }

  // Resolve target organizer
  const targetOrgId = resolveTargetOrgId({
    isSuper: auth.isSuper,
    oid: auth.oid,
    organizerIdFromQuery: organizerId,
    requireExplicitForSuper: false,
  });

  if (!targetOrgId) {
    // This happens for superadmin without organizerId AND not impersonating, but not list mode (should be rare).
    return err(400, 'Missing organizerId');
  }

  const organizer = await prisma.organizer.findUnique({
    where: { id: targetOrgId },
    select: { id: true, name: true, email: true, status: true, brand: true, createdAt: true },
  });
  if (!organizer) return err(404, 'Organizer not found');

  const events = await prisma.event.findMany({
    where: { organizerId: targetOrgId },
    orderBy: [{ date: 'desc' }],
    select: { id: true, slug: true, title: true, date: true, status: true },
    take: 200,
  });

  return ok({ organizer, brand: asObj(organizer.brand), events });
}

// ------------------------------------------------------------
// PATCH body supports 3 modes:
// 1) { organizerId?, brand }                     -> replace brand (sanitized badge parts)
// 2) { organizerId?, patch }                     -> shallow merge into brand
// 3) { organizerId?, eventSlug, badge }          -> set brand.events[eventSlug].badge
//
// Tenant ignores organizerId and always uses sess.oid.
// Superadmin requires organizerId unless impersonating (sess.oid).
// ------------------------------------------------------------
export async function PATCH(req: Request) {
  const auth = getAuth();
  if (!auth.ok) return err(auth.status, auth.error);

  const body = (await req.json().catch(() => ({}))) as any;

  // Tenant safety: if tenant tries to pass organizerId, ignore it (don’t error; just scope)
  const organizerIdFromBody = auth.isSuper ? String(body.organizerId || '') : '';

  const targetOrgId = resolveTargetOrgId({
    isSuper: auth.isSuper,
    oid: auth.oid,
    organizerIdFromBody,
    requireExplicitForSuper: true,
  });

  if (!targetOrgId) return err(400, 'Missing organizerId');

  const organizer = await prisma.organizer.findUnique({
    where: { id: targetOrgId },
    select: { id: true, brand: true },
  });
  if (!organizer) return err(404, 'Organizer not found');

  const prev = asObj(organizer.brand);

  // Mode 3: set event override
  const eventSlug = (body.eventSlug || '').toString().trim();
  if (eventSlug) {
    const badge = sanitizeBadge(body.badge);
    const next = { ...prev };

    if (!next.events || typeof next.events !== 'object' || Array.isArray(next.events)) next.events = {};
    if (!next.events[eventSlug] || typeof next.events[eventSlug] !== 'object' || Array.isArray(next.events[eventSlug])) {
      next.events[eventSlug] = {};
    }

    next.events[eventSlug].badge = badge;

    const updated = await prisma.organizer.update({
      where: { id: targetOrgId },
      data: { brand: next },
      select: { id: true, brand: true },
    });

    return ok({ organizerId: updated.id, brand: asObj(updated.brand) });
  }

  // Mode 1: replace brand
  if (body.brand) {
    const incoming = asObj(body.brand);

    if (incoming.badge) incoming.badge = sanitizeBadge(incoming.badge);

    if (incoming.events && typeof incoming.events === 'object' && !Array.isArray(incoming.events)) {
      for (const k of Object.keys(incoming.events)) {
        const row = incoming.events[k];
        if (row && typeof row === 'object' && !Array.isArray(row) && (row as any).badge) {
          (row as any).badge = sanitizeBadge((row as any).badge);
        }
      }
    }

    const updated = await prisma.organizer.update({
      where: { id: targetOrgId },
      data: { brand: incoming },
      select: { id: true, brand: true },
    });

    return ok({ organizerId: updated.id, brand: asObj(updated.brand) });
  }

  // Mode 2: shallow merge patch
  const patch = asObj(body.patch);
  if (patch.badge) patch.badge = sanitizeBadge(patch.badge);

  const merged = mergeBrand(prev, patch);

  const updated = await prisma.organizer.update({
    where: { id: targetOrgId },
    data: { brand: merged },
    select: { id: true, brand: true },
  });

  return ok({ organizerId: updated.id, brand: asObj(updated.brand) });
}
