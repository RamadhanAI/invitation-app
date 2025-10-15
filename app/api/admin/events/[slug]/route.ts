// app/api/admin/events/[slug]/route.ts
// app/api/admin/events/[slug]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ────────────────────────────────────────────────────────────
// Gate: accept organizer apiKey OR ADMIN_KEY
// Sources (in order): header x-api-key, Bearer token, cookie "admin_key", ?key=
// ────────────────────────────────────────────────────────────
async function gate(req: Request, slug: string) {
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const bearer = (req.headers.get('authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const cookieKey = (cookies().get('admin_key')?.value ?? '').trim();
  const urlKey = new URL(req.url).searchParams.get('key')?.trim() ?? '';

  const provided = headerKey || bearer || cookieKey || urlKey;
  const admin = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };

  const orgKey = event.organizer?.apiKey?.trim() || '';
  if (!provided || (provided !== admin && provided !== orgKey)) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }
  return { ok: true as const, eventId: event.id };
}

// ────────────────────────────────────────────────────────────
// Helpers: coerce body → update data, and perform update
// ────────────────────────────────────────────────────────────
function coerceUpdate(raw: any):
  | { ok: true; data: Record<string, any> }
  | { ok: false; error: string } {
  const data: any = {};
  if (raw == null || typeof raw !== 'object') return { ok: true, data };

  if (typeof raw.title === 'string') data.title = raw.title.trim();
  if (typeof raw.slug === 'string') data.slug = raw.slug.trim().toLowerCase();

  if (raw.date !== undefined) {
    const d = new Date(String(raw.date));
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
    data.date = d;
  }

  if (raw.price !== undefined) data.price = Number(raw.price) || 0;
  if (typeof raw.currency === 'string') data.currency = raw.currency.trim().toUpperCase();
  if (raw.venue !== undefined) data.venue = raw.venue ? String(raw.venue).trim() : null;
  if (raw.capacity !== undefined) data.capacity = raw.capacity == null ? null : Number(raw.capacity);
  if (typeof raw.description === 'string') data.description = raw.description;
  if (typeof raw.status === 'string') data.status = raw.status;

  return { ok: true, data };
}

async function doUpdate(slug: string, data: Record<string, any>) {
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  try {
    const updated = await prisma.event.update({
      where: { slug },
      data,
      select: {
        id: true, slug: true, title: true, date: true,
        price: true, currency: true, venue: true,
        capacity: true, status: true, description: true,
      },
    });
    return NextResponse.json({ ok: true, event: updated });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// GET /api/admin/events/[slug]
//  - Also supports GET + ?_method=DELETE (delegates to DELETE)
// ────────────────────────────────────────────────────────────
export async function GET(req: Request, ctx: { params: { slug: string } }) {
  const url = new URL(req.url);
  const override = (url.searchParams.get('_method') || '').toUpperCase();
  if (override === 'DELETE') {
    return DELETE(req, ctx); // gate enforced in DELETE
  }

  const g = await gate(req, ctx.params.slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const event = await prisma.event.findUnique({
    where: { slug: ctx.params.slug },
    include: { organizer: { select: { id: true, name: true, email: true } } },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json({ ok: true, event });
}

// PATCH /api/admin/events/[slug]
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = coerceUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  return doUpdate(params.slug, parsed.data);
}

// ────────────────────────────────────────────────────────────
// POST (default to PATCH) + method-override for forms
//  - Header: X-HTTP-Method-Override: PATCH|DELETE
//  - Query : ?_method=PATCH|DELETE
//  - No override → treat as PATCH (so plain POST works)
// ────────────────────────────────────────────────────────────
export async function POST(req: Request, ctx: { params: { slug: string } }) {
  const url = new URL(req.url);
  const override =
    (req.headers.get('x-http-method-override') ?? url.searchParams.get('_method') ?? '')
      .toString()
      .toUpperCase() || 'PATCH';

  if (override === 'DELETE') {
    return DELETE(req, ctx);
  }

  if (override === 'PATCH') {
    const g = await gate(req, ctx.params.slug);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

    let body: any = {};
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await req.json().catch(() => ({}));
    } else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
    }
    const parsed = coerceUpdate(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    return doUpdate(ctx.params.slug, parsed.data);
  }

  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

// DELETE /api/admin/events/[slug]
export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const g = await gate(req, params.slug);
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  try {
    await prisma.event.delete({ where: { slug: params.slug } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Preflight
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
