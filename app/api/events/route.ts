// app/api/events/route.ts
// app/api/events/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readKey(req: Request) {
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return (headerKey || bearer).trim();
}

const ADMIN = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

/** Make clean, URL-safe slugs (e.g., "Bananas today!" -> "bananas-today") */
function slugify(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureDefaultOrganizer() {
  const first = await prisma.organizer.findFirst({ select: { id: true } });
  if (first) return first.id;

  const apiKey = crypto.randomBytes(24).toString('base64url');
  const email = `demo+${crypto.randomBytes(6).toString('hex')}@localhost`; // organizer.email is required

  const org = await prisma.organizer.create({
    data: { name: 'Demo Organizer', apiKey, email },
    select: { id: true },
  });
  return org.id;
}

async function resolveOrganizerIdFromKey(key: string) {
  if (ADMIN && key === ADMIN) {
    return { organizerId: await ensureDefaultOrganizer(), isAdmin: true as const };
  }
  const org = await prisma.organizer.findUnique({
    where: { apiKey: key },
    select: { id: true },
  });
  return { organizerId: org?.id ?? null, isAdmin: false as const };
}

/* ---------- GET: list events ---------- */
export async function GET(req: Request) {
  const key = readKey(req);
  try {
    if (ADMIN && key === ADMIN) {
      const events = await prisma.event.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, slug: true, title: true, date: true, price: true, currency: true, status: true, venue: true },
      });
      return NextResponse.json({ ok: true, events });
    }

    if (key) {
      const { organizerId } = await resolveOrganizerIdFromKey(key);
      if (!organizerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      // ✅ Correct relation filter
      const events = await prisma.event.findMany({
        where: { organizer: { is: { id: organizerId } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, slug: true, title: true, date: true, price: true, currency: true, status: true, venue: true },
      });
      return NextResponse.json({ ok: true, events });
    }

    // Public list (published only)
    const events = await prisma.event.findMany({
      where: { status: 'published' as any },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, slug: true, title: true, date: true, price: true, currency: true, status: true, venue: true },
    });
    return NextResponse.json({ ok: true, events });
  } catch (e: any) {
    if (e?.code === 'P1001') {
      console.warn('[events] GET: DB unreachable (P1001). Returning empty list.');
      return NextResponse.json({ ok: true, events: [] }, { status: 200 });
    }
    console.error('GET /api/events error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/* ---------- POST: create event ---------- */
export async function POST(req: Request) {
  const key = readKey(req);
  if (!key) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    title, slug, date,
    price = 0, currency = 'USD',
    venue, capacity,
    description = '',
    status = 'published',
    // bannerUrl, templateId // future fields
  } = (await req.json().catch(() => ({} as any))) || {};

  if (!title || !(slug || title)) {
    return NextResponse.json({ error: 'Missing title or slug' }, { status: 400 });
  }

  const parsedDate = date ? new Date(String(date)) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  // ✅ Normalize slug
  const canonicalSlug = slugify(slug || title);

  try {
    const { organizerId, isAdmin } = await resolveOrganizerIdFromKey(key);
    if (!organizerId) {
      return NextResponse.json(
        { error: isAdmin ? 'No organizer configured' : 'Unauthorized' },
        { status: isAdmin ? 400 : 401 },
      );
    }

    const event = await prisma.event.create({
      data: {
        title: String(title).trim(),
        slug: canonicalSlug,
        date: parsedDate,
        price: Number(price) || 0,
        currency: String(currency || 'USD'),
        venue: venue ? String(venue).trim() : null,
        capacity: typeof capacity === 'number' ? capacity : capacity ? Number(capacity) : null,
        description: String(description || ''),
        status: String(status || 'published') as any,
        // ✅ Your schema exposes only the relation (no organizerId scalar in CreateInput)
        organizer: { connect: { id: organizerId } },
      },
      select: { id: true, slug: true },
    });

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (e?.code === 'P2002' || msg.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    if (e?.code === 'P1001') {
      return NextResponse.json(
        { error: 'Database unreachable (pooler). Verify DATABASE_URL or use DIRECT_URL on :5432 in dev.' },
        { status: 503 }
      );
    }
    console.error('Create event error:', e);
    return NextResponse.json({ error: 'Internal error', detail: msg }, { status: 500 });
  }
}
