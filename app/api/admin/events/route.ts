// app/api/admin/events/route.ts
// app/api/admin/events/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import crypto from 'node:crypto';
import { resolveBadgeConfig, normalizeBrand, type BadgeConfig } from '@/lib/badgeConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isObj(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function hasAnyKeys(cfg: BadgeConfig | null | undefined) {
  if (!cfg) return false;
  return Object.keys(cfg).length > 0;
}

async function ensureDefaultOrganizer() {
  const first = await prisma.organizer.findFirst({ select: { id: true } });
  if (first) return first.id;

  const apiKey = crypto.randomBytes(24).toString('base64url');
  const email = `demo+${crypto.randomBytes(6).toString('hex')}@localhost`;

  const org = await prisma.organizer.create({
    data: { name: 'Demo Organizer', apiKey, email },
    select: { id: true },
  });
  return org.id;
}

/**
 * Persist per-event badge override INSIDE Organizer.brand JSON:
 * organizer.brand.events[slug].badge = <sanitized BadgeConfig>
 */
async function persistOrganizerEventBadge(opts: {
  organizerId: string;
  eventSlug: string;
  badgeOverride: unknown;
}) {
  // Load existing organizer brand json
  const org = await prisma.organizer.findUnique({
    where: { id: opts.organizerId },
    select: { brand: true },
  });
  const brand = normalizeBrand(org?.brand);

  // Sanitize incoming override (allowed templates/bg/https urls/hex)
  const cfg = resolveBadgeConfig({
    organizerBrand: {}, // sanitize against allowlists, not inheriting defaults here
    eventSlug: null,
    requestBadgeOverride: opts.badgeOverride,
  });

  // If empty override, do nothing
  if (!hasAnyKeys(cfg)) return { saved: false as const, cfg };

  // Ensure events map
  const nextBrand = { ...brand };
  const events = isObj(nextBrand.events) ? { ...nextBrand.events } : {};
  const one = isObj(events[opts.eventSlug]) ? { ...events[opts.eventSlug] } : {};

  one.badge = cfg; // store sanitized config only
  events[opts.eventSlug] = one;
  nextBrand.events = events;

  await prisma.organizer.update({
    where: { id: opts.organizerId },
    data: { brand: nextBrand },
    select: { id: true },
  });

  return { saved: true as const, cfg };
}

// ---------- GET: list tenant events ----------
export async function GET() {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isSuper = session.role === 'superadmin';

  const events = await prisma.event.findMany({
    where: isSuper ? undefined : { organizerId: session.oid || '' },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      date: true,
      price: true,
      currency: true,
      status: true,
      venue: true,
      organizerId: true,
      organizer: { select: { name: true } },
    },
  });

  return NextResponse.json({ ok: true, events });
}

// ---------- POST: create event (tenant-scoped) ----------
export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const isSuper = session.role === 'superadmin';
  const body = (await req.json().catch(() => ({}))) as any;

  const title = String(body.title || '').trim();
  const date = body.date ? new Date(String(body.date)) : new Date();
  const price = Number(body.price) || 0;
  const currency = String(body.currency || 'USD');
  const venue = body.venue ? String(body.venue).trim() : null;
  const capacity =
    typeof body.capacity === 'number' ? body.capacity : body.capacity ? Number(body.capacity) : null;
  const description = String(body.description || '');
  const status = String(body.status || 'published');
  const canonicalSlug = slugify(body.slug || title);

  // NEW: optional badge override coming from Badge Studio UI
  const badgeOverride = body.badge;

  if (!title) return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  if (!canonicalSlug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

  // tenant target
  let organizerId = session.oid || null;

  // superadmin can explicitly set organizerId; otherwise use default
  if (isSuper) {
    organizerId = body.organizerId ? String(body.organizerId) : await ensureDefaultOrganizer();
  }

  if (!organizerId) return NextResponse.json({ error: 'No organizer scope' }, { status: 400 });

  try {
    const event = await prisma.event.create({
      data: {
        title,
        slug: canonicalSlug,
        date,
        price,
        currency,
        venue,
        capacity,
        description,
        status: status as any,
        organizer: { connect: { id: organizerId } },
      },
      select: { id: true, slug: true },
    });

    // ✅ Persist per-event override into Organizer.brand.events[slug].badge
    // Do NOT fail event creation if branding save fails; return event anyway.
    let badgeSaved = false;
    let savedBadge: BadgeConfig | null = null;

    if (badgeOverride !== undefined) {
      try {
        const r = await persistOrganizerEventBadge({
          organizerId,
          eventSlug: event.slug,
          badgeOverride,
        });
        badgeSaved = r.saved;
        savedBadge = r.cfg ?? null;
      } catch {
        badgeSaved = false;
        savedBadge = null;
      }
    }

    return NextResponse.json(
      { ok: true, event, badgeSaved, badge: savedBadge },
      { status: 201 }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (e?.code === 'P2002' || msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 });
  }
}
