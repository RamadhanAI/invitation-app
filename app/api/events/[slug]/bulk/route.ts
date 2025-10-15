// app/api/events/[slug]/bulk/route
// app/api/events/[slug]/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminForSlug } from '@/lib/adminAuth';
import { verifyTicket, isLikelyJwt } from '@/lib/tokens';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BulkItem = {
  id?: string;
  qrToken?: string;
  token?: string; // JWT or legacy qrToken
  attended?: boolean;
  paid?: boolean;
};

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: gate.status });

  const { updates } = (await req.json().catch(() => ({}))) as { updates?: BulkItem[] };
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  // IMPORTANT: PrismaPromise, not Promise
  const ops: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];

  for (const u of updates) {
    let where: Prisma.RegistrationWhereInput | null = null;

    if (u.id) {
      where = { id: u.id, eventId: gate.eventId };
    } else if (u.qrToken) {
      where = { qrToken: u.qrToken, eventId: gate.eventId };
    } else if (u.token) {
      let regId: string | null = null;
      if (isLikelyJwt(u.token)) regId = verifyTicket(u.token)?.sub ?? null;
      where = regId
        ? { id: regId, eventId: gate.eventId }
        : { qrToken: u.token, eventId: gate.eventId };
    }

    if (!where) continue;

    const data: Prisma.RegistrationUpdateManyMutationInput = {};
    if (typeof u.attended === 'boolean') {
      data.attended = u.attended;
      data.scannedAt = u.attended ? new Date() : null;
    }
    if (typeof u.paid === 'boolean') data.paid = u.paid;
    if (Object.keys(data).length === 0) continue;

    ops.push(prisma.registration.updateMany({ where, data }));
  }

  if (ops.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const results = await prisma.$transaction(ops);
  const updated = results.reduce((sum, r) => sum + r.count, 0);

  return NextResponse.json({ ok: true, updated }, { headers: { 'cache-control': 'no-store' } });
}
