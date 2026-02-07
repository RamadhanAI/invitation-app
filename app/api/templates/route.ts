// app/api/templates/route.ts
// app/api/templates/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILTIN = [
  {
    id: 'builtin:tech-conference',
    name: 'Tech Conference',
    description: 'Two-track tech conference with expo area.',
    defaults: {
      title: 'Tech Conference',
      venue: 'Main Hall A',
      capacity: 500,
      price: 0,
      currency: 'USD',
      bannerUrl: '/images/banners/tech.jpg',
      description: 'A full-day event featuring talks, workshops, and networking with tech leaders.',
    },
  },
  {
    id: 'builtin:ai-workshop',
    name: 'AI Workshop',
    description: 'Hands-on training with small-group labs.',
    defaults: {
      title: 'AI Workshop',
      venue: 'Innovation Lab',
      capacity: 80,
      price: 15000,
      currency: 'USD',
      bannerUrl: '/images/banners/ai.jpg',
      description: 'A practical, instructor-led workshop on modern AI tooling and deployment.',
    },
  },
  {
    id: 'builtin:food-expo',
    name: 'Food & Beverage Expo',
    description: 'Trade exhibition with buyer–supplier matchmaking.',
    defaults: {
      title: 'Food & Beverage Expo',
      venue: 'Exhibition Center',
      capacity: 2000,
      price: 0,
      currency: 'AED',
      bannerUrl: '/images/banners/food.jpg',
      description: 'Regional showcase of F&B brands, logistics providers, and packaging solutions.',
    },
  },
  {
    id: 'builtin:fintech-meetup',
    name: 'FinTech Meetup',
    description: 'Evening meetup + panel + networking.',
    defaults: {
      title: 'FinTech Meetup',
      venue: 'City Hub',
      capacity: 150,
      price: 0,
      currency: 'USD',
      bannerUrl: '/images/banners/fintech.jpg',
      description: 'A community evening focused on payments, compliance, and digital banking.',
    },
  },
] as const;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function isObj(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * GET behavior:
 * - No session: built-ins only.
 * - Superadmin: built-ins + ALL DB templates.
 * - Tenant admin/editor: built-ins + templates scoped to sess.oid (organizerId).
 */
export async function GET() {
  const sess = getAdminSession();
  const role = String(sess?.role || '');
  const isSuper = role === 'superadmin';
  const oid = (sess?.oid || '').toString().trim();

  try {
    if (!sess) return json({ ok: true, templates: [...BUILTIN] });

    // ✅ Tenant users must have an organizer scope.
    if (!isSuper && !oid) return json({ ok: true, templates: [...BUILTIN] });

    const where = isSuper ? undefined : ({ organizerId: oid } as any);

    const db = await prisma.eventTemplate.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        defaults: true,
        organizerId: true,
      },
      take: 500,
    });

    return json({ ok: true, templates: [...BUILTIN, ...db] });
  } catch (e: any) {
    if (e?.code === 'P1001') {
      console.warn('[templates] DB unreachable (P1001). Returning built-ins.');
      return json({ ok: true, templates: [...BUILTIN] });
    }
    console.warn('[templates] GET error:', e?.message || e);
    return json({ ok: true, templates: [...BUILTIN] });
  }
}

/**
 * POST behavior:
 * - Requires admin session.
 * - Superadmin can create templates for any organizer:
 *   body.organizerId (optional) or falls back to first organizer in DB.
 * - Tenant admin/editor can create only for their own organizer (sess.oid).
 * - Scanner cannot create templates.
 */
export async function POST(req: Request) {
  const sess = getAdminSession();
  if (!sess) return json({ ok: false, error: 'Unauthorized' }, 401);

  const role = String(sess.role || '');
  const isSuper = role === 'superadmin';
  const canWrite = isSuper || role === 'admin' || role === 'editor';
  if (!canWrite) return json({ ok: false, error: 'Forbidden' }, 403);

  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const name = (body?.name || '').toString().trim();
    const description = (body?.description || '').toString().trim() || null;
    const defaults = body?.defaults;

    if (!name || !isObj(defaults)) {
      return json({ ok: false, error: 'Provide name and defaults (object)' }, 400);
    }

    // ✅ Determine organizerId for the new template (NEVER null for tenant writes)
    let organizerId: string | null = null;

    if (isSuper) {
      const requested = (body?.organizerId || '').toString().trim();
      if (requested) {
        const org = await prisma.organizer.findUnique({
          where: { id: requested },
          select: { id: true },
        });
        if (!org) return json({ ok: false, error: 'Organizer not found' }, 404);
        organizerId = org.id;
      } else {
        const org = await prisma.organizer.findFirst({
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });
        organizerId = org?.id ?? null;
      }
    } else {
      organizerId = (sess.oid || '').toString().trim() || null;
    }

    if (!organizerId) {
      return json({ ok: false, error: 'No organizer scope available' }, 400);
    }

    const tpl = await prisma.eventTemplate.create({
      data: {
        organizerId, // ✅ always set
        name,
        description,
        defaults,
      } as any,
      select: {
        id: true,
        organizerId: true,
        name: true,
        description: true,
        defaults: true,
      },
    });

    return json({ ok: true, template: tpl }, 201);
  } catch (e: any) {
    if (e?.code === 'P1001') {
      return json({ ok: false, error: 'Database unreachable. Check DATABASE_URL/DIRECT_URL.' }, 503);
    }
    // Unique constraint (your @@unique([organizerId, name]) can trigger this)
    if (e?.code === 'P2002') {
      return json({ ok: false, error: 'Template name already exists for this organizer.' }, 409);
    }
    console.error('[templates] POST error:', e);
    return json({ ok: false, error: 'Internal error' }, 500);
  }
}
