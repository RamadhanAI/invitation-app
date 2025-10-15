// app/api/events/[slug]/registration/import/route.ts
// app/api/events/[slug]/registration/import/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { mergeMeta, pickAttendeeMeta, toInputJson } from '@/lib/meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireGate(req: Request, slug: string) {
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearerKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided = (headerKey || bearerKey).trim();
  const admin = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, price: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };

  const orgKey = (event.organizer?.apiKey || '').trim();
  const ok = !!provided && (provided === admin || provided === orgKey);
  if (!ok) return { ok: false as const, status: 401, error: 'Unauthorized' };

  return { ok: true as const, event };
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const gate = await requireGate(req, params.slug);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const { event } = gate;

    const rows = (await req.json().catch(() => [])) as Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      companyName?: string;
      jobTitle?: string;
      [k: string]: unknown;
    }>;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let created = 0;
    let updated = 0;

    for (const raw of rows) {
      const email = (raw.email || '').trim().toLowerCase();
      if (!email) continue;

      const existing = await prisma.registration.findUnique({
        where: { eventId_email: { eventId: event.id, email } },
        select: { id: true, meta: true, price: true, paid: true, qrToken: true },
      });

      // Merge + convert to Prisma.InputJsonValue
      const metaJson = toInputJson(mergeMeta(existing?.meta, pickAttendeeMeta(raw))) as unknown as Prisma.InputJsonValue;

      if (!existing) {
        await prisma.registration.create({
          data: {
            eventId: event.id,
            email,
            price: event.price,
            paid: event.price === 0,
            qrToken: cryptoRandomBase64Url(18),
            meta: metaJson,
          },
        });
        created++;
      } else {
        await prisma.registration.update({
          where: { id: existing.id },
          data: { meta: metaJson },
        });
        updated++;
      }
    }

    return NextResponse.json({ ok: true, created, updated });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function cryptoRandomBase64Url(bytes = 18) {
  const buf = Buffer.allocUnsafe(bytes);
  for (let i = 0; i < bytes; i++) buf[i] = (Math.random() * 256) | 0;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
