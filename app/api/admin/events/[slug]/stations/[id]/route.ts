// app/api/admin/events/[slug]/stations/[id]/route.ts
// app/api/admin/events/[slug]/stations/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';
import { resolveEventScope } from '@/lib/resolveEventScope';

function maskStation(row: { id: string; name: string; code: string; active: boolean; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    apiKeyMasked: `code: ${row.code}${row.active ? '' : ' (inactive)'}`,
    lastUsedAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensureStationBelongs(eventId: string, stationId: string) {
  const st = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true, eventId: true, name: true, code: true, active: true, createdAt: true },
  });
  if (!st) return { ok: false as const, status: 404, error: 'station not found' };
  if (st.eventId !== eventId) return { ok: false as const, status: 403, error: 'station not for this event' };
  return { ok: true as const, station: st };
}

export async function PATCH(req: Request, { params }: { params: { slug: string; id: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  if (scope.mode !== 'session') return NextResponse.json({ ok: false, error: 'Session required' }, { status: 401 });

  const belongs = await ensureStationBelongs(scope.eventId, params.id);
  if (!belongs.ok) return NextResponse.json({ ok: false, error: belongs.error }, { status: belongs.status });

  let body: any = {};
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) body = await req.json().catch(() => ({}));
  else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }

  const dataToUpdate: Record<string, any> = {};
  let freshSecretPlain: string | undefined;

  if (body.rotate === true || body.rotate === 'true') {
    freshSecretPlain = crypto.randomBytes(24).toString('base64url');
    dataToUpdate.secretHash = await hashSecret(freshSecretPlain);
  }
  if (typeof body.name === 'string') dataToUpdate.name = body.name.trim();
  if (typeof body.code === 'string') dataToUpdate.code = body.code.trim();
  if (typeof body.active === 'boolean') dataToUpdate.active = body.active;
  else if (typeof body.active === 'string') dataToUpdate.active = body.active === 'true';

  if (!Object.keys(dataToUpdate).length) {
    return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  const updated = await prisma.station.update({
    where: { id: params.id },
    data: dataToUpdate,
    select: { id: true, name: true, code: true, active: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, station: maskStation(updated), ...(freshSecretPlain ? { secret: freshSecretPlain } : {}) });
}

export async function DELETE(req: Request, { params }: { params: { slug: string; id: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  if (scope.mode !== 'session') return NextResponse.json({ ok: false, error: 'Session required' }, { status: 401 });

  const belongs = await ensureStationBelongs(scope.eventId, params.id);
  if (!belongs.ok) return NextResponse.json({ ok: false, error: belongs.error }, { status: belongs.status });

  await prisma.station.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, deleted: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
