// app/api/admin/events/[slug]/route.ts
// app/api/admin/events/[slug]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // hard block organizerId changes from this endpoint (multi-tenant safety)
  if ('organizerId' in raw) return { ok: false, error: 'Cannot change organizerId' };

  return { ok: true, data };
}

async function doUpdateById(eventId: string, data: Record<string, any>) {
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  try {
    const updated = await prisma.event.update({
      where: { id: eventId },
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

export async function GET(req: Request, ctx: { params: { slug: string } }) {
  // keep your method override compatibility
  const url = new URL(req.url);
  const override = (url.searchParams.get('_method') || '').toUpperCase();
  if (override === 'DELETE') return DELETE(req, ctx);

  const scope = await resolveEventScope(req, ctx.params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const event = await prisma.event.findUnique({
    where: { id: scope.eventId },
    include: { organizer: { select: { id: true, name: true, email: true } } },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  return NextResponse.json({ ok: true, event });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const body = await req.json().catch(() => ({}));
  const parsed = coerceUpdate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  return doUpdateById(scope.eventId, parsed.data);
}

export async function POST(req: Request, ctx: { params: { slug: string } }) {
  const url = new URL(req.url);
  const override =
    (req.headers.get('x-http-method-override') ?? url.searchParams.get('_method') ?? '')
      .toString()
      .toUpperCase() || 'PATCH';

  if (override === 'DELETE') return DELETE(req, ctx);
  if (override !== 'PATCH') return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });

  const scope = await resolveEventScope(req, ctx.params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

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

  return doUpdateById(scope.eventId, parsed.data);
}

export async function DELETE(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  try {
    await prisma.event.delete({ where: { id: scope.eventId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
