// app/api/admin/events/[slug]/stations/[id]/route.ts
// app/api/admin/events/[slug]/stations/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';
import { getAdminUsernameOrNull } from '@/lib/adminSession';

function maskStation(row: {
  id: string;
  name: string;
  code: string;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    apiKeyMasked: `code: ${row.code}${row.active ? '' : ' (inactive)'}`,
    lastUsedAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

// helper: confirm that station `[id]` belongs to event slug `[slug]`
async function ensureStationBelongsToSlug(stationId: string, slug: string) {
  const st = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true, eventId: true },
  });
  if (!st) {
    return { ok: false as const, status: 404 as const, error: 'station not found' };
  }

  const ev = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!ev) {
    return { ok: false as const, status: 404 as const, error: 'event not found' };
  }

  if (st.eventId !== ev.id) {
    return { ok: false as const, status: 403 as const, error: 'station not for this event' };
  }

  return { ok: true as const, eventId: ev.id };
}

// PATCH /api/admin/events/[slug]/stations/[id]
// body can be:
//   { rotate: true }
//   { name, code, active }
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  // cookie auth
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  // ensure correct event/station
  const belongs = await ensureStationBelongsToSlug(params.id, params.slug);
  if (!belongs.ok) {
    return NextResponse.json(
      { ok: false, error: belongs.error },
      { status: belongs.status }
    );
  }

  // parse body
  let body: any = {};
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    body = await req.json().catch(() => ({}));
  } else if (
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('multipart/form-data')
  ) {
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }

  const dataToUpdate: Record<string, any> = {};
  let freshSecretPlain: string | undefined;

  // rotate secret?
  if (body.rotate === true || body.rotate === 'true') {
    freshSecretPlain = crypto.randomBytes(24).toString('base64url');
    dataToUpdate.secretHash = await hashSecret(freshSecretPlain);
  }

  // rename / recode / toggle active
  if (typeof body.name === 'string') {
    dataToUpdate.name = body.name.trim();
  }
  if (typeof body.code === 'string') {
    dataToUpdate.code = body.code.trim();
  }
  if (typeof body.active === 'boolean') {
    dataToUpdate.active = body.active;
  } else if (typeof body.active === 'string') {
    dataToUpdate.active = body.active === 'true';
  }

  if (!Object.keys(dataToUpdate).length) {
    return NextResponse.json(
      { ok: false, error: 'Nothing to update' },
      { status: 400 }
    );
  }

  const updated = await prisma.station.update({
    where: { id: params.id },
    data: dataToUpdate,
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    station: maskStation(updated),
    ...(freshSecretPlain ? { secret: freshSecretPlain } : {}),
  });
}

// DELETE /api/admin/events/[slug]/stations/[id]
// HARD DELETE (no more soft deactivate)
export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  // cookie auth
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  // ensure correct event/station
  const belongs = await ensureStationBelongsToSlug(params.id, params.slug);
  if (!belongs.ok) {
    return NextResponse.json(
      { ok: false, error: belongs.error },
      { status: belongs.status }
    );
  }

  // HARD DELETE
  await prisma.station.delete({
    where: { id: params.id },
  });

  return NextResponse.json({
    ok: true,
    deleted: true,
  });
}

// OPTIONS
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
