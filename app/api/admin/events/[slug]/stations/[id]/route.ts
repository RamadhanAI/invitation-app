// app/api/admin/events/[slug]/stations/[id]/route.ts
// app/api/admin/events/[slug]/stations/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminForSlug } from '@/lib/adminAuth';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}
function ok(data: any) {
  return NextResponse.json({ ok: true, ...data });
}

// PATCH /api/admin/events/[slug]/stations/[id]
export async function PATCH(
  req: Request,
  {
    params,
  }: { params: { slug: string; id: string } }
) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.status }
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

  // ensure station belongs to that event
  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== gate.eventId) {
    return bad('Not found', 404);
  }

  // rotateSecret?
  if (body.rotateSecret) {
    const secretPlain = crypto
      .randomBytes(24)
      .toString('base64url');
    const secretHash = await hashSecret(secretPlain);

    await prisma.station.update({
      where: { id: st.id },
      data: { secretHash },
    });

    return ok({ secret: secretPlain });
  }

  // rename / toggle active / change code
  const data: any = {};
  if (typeof body.name === 'string') {
    data.name = body.name.trim();
  }
  if (typeof body.code === 'string') {
    data.code = body.code.trim();
  }
  if (typeof body.active === 'string') {
    // "true"/"false" from formdata
    data.active = body.active === 'true';
  } else if (typeof body.active === 'boolean') {
    data.active = body.active;
  }

  if (!Object.keys(data).length) {
    return bad('Nothing to update');
  }

  const updated = await prisma.station.update({
    where: { id: st.id },
    data,
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      createdAt: true,
    },
  });

  return ok({ station: updated });
}

// DELETE /api/admin/events/[slug]/stations/[id]
export async function DELETE(
  req: Request,
  {
    params,
  }: { params: { slug: string; id: string } }
) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.status }
    );
  }

  // soft delete => set active=false
  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== gate.eventId) {
    return bad('Not found', 404);
  }

  await prisma.station.update({
    where: { id: st.id },
    data: { active: false },
  });

  return ok({ deleted: true });
}

// Preflight
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
