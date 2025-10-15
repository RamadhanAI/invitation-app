// app/api/events/[slug]/registration/bulk/route.ts
// app/api/events/[slug]/registration/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, ipKey } from '@/lib/rateLimit';
import type { Prisma } from '@prisma/client';
import { isLikelyJwt, verifyTicket } from '@/lib/tokens';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

// --- Admin gate: organizer.apiKey OR ADMIN_KEY / NEXT_PUBLIC_ADMIN_KEY OR Authorization: Bearer <key> ---
async function requireAdmin(req: Request, slug: string) {
  // accept x-api-key or Authorization: Bearer
  const headerKey = req.headers.get('x-api-key') ?? '';
  const auth      = req.headers.get('authorization') ?? '';
  const bearerKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided  = (headerKey || bearerKey).trim();

  const devKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };

  const organizerKey = (event.organizer?.apiKey || '').trim();
  const ok = !!provided && (provided === organizerKey || (devKey && provided === devKey));
  if (!ok) return { ok: false as const, status: 401, error: 'Unauthorized' };

  return { ok: true as const, eventId: event.id };
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    // modest admin rate limit
    const rl = rateLimit({ key: ipKey(req, 'admin-bulk-reg'), limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
    }

    const gate = await requireAdmin(req, params.slug);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    type Body = {
      emails?: string[];
      tokens?: string[];   // can be qrToken or JWT
      ids?: string[];      // registration ids (optional)
      paid?: boolean;
      attended?: boolean;
    };

    const body = (await req.json().catch(() => ({}))) as Body;

    // normalize lists
    const emails = Array.isArray(body.emails)
      ? [...new Set(body.emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean))]
      : [];

    const rawTokens = Array.isArray(body.tokens)
      ? [...new Set(body.tokens.map((t) => String(t).trim()).filter(Boolean))]
      : [];

    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.map((i) => String(i).trim()).filter(Boolean))]
      : [];

    // split tokens into JWT-derived IDs vs legacy qrTokens
    const jwtIds: string[] = [];
    const qrTokens: string[] = [];
    for (const t of rawTokens) {
      if (isLikelyJwt(t)) {
        const p = verifyTicket(t);
        if (p?.sub) jwtIds.push(p.sub);
        else qrTokens.push(t); // not verifiable → treat as legacy
      } else {
        qrTokens.push(t);
      }
    }

    if (!emails.length && !qrTokens.length && !jwtIds.length && !ids.length) {
      return NextResponse.json({ error: 'Provide at least one of: emails[], tokens[], ids[]' }, { status: 400 });
    }

    // build WHERE with eventId + OR of provided selectors
    const or: Prisma.RegistrationWhereInput[] = [];
    if (emails.length)   or.push({ email: { in: emails } });
    if (qrTokens.length) or.push({ qrToken: { in: qrTokens } });
    if (jwtIds.length)   or.push({ id: { in: jwtIds } });
    if (ids.length)      or.push({ id: { in: ids } });

    const where: Prisma.RegistrationWhereInput =
      or.length > 1 ? { eventId: gate.eventId, OR: or } :
      or.length === 1 ? { eventId: gate.eventId, ...or[0] } :
      { eventId: gate.eventId }; // (shouldn’t happen because of the earlier guard)

    // build update payload
    const data: Prisma.RegistrationUpdateManyMutationInput = {};
    if (typeof body.paid === 'boolean') data.paid = body.paid;
    if (typeof body.attended === 'boolean') {
      data.attended = body.attended;
      data.scannedAt = body.attended ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update (set paid and/or attended)' }, { status: 400 });
    }

    // Perform update and return affected rows atomically
    const rows = await prisma.$transaction(async (tx) => {
      await tx.registration.updateMany({ where, data });

      return tx.registration.findMany({
        where,
        select: {
          id: true,
          email: true,
          paid: true,
          attended: true,
          registeredAt: true,
          scannedAt: true,
          qrToken: true,
          meta: true,
        },
        orderBy: { registeredAt: 'desc' },
      });
    });

    return NextResponse.json(
      { ok: true, count: rows.length, rows },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (e) {
    console.error('Bulk PATCH error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
