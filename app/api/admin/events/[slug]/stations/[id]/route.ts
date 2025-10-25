// app/api/admin/events/[slug]/stations/[id]/route.ts
// app/api/admin/events/[slug]/stations/[id]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers, cookies } from 'next/headers';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';

const ok = (data: any) => NextResponse.json({ ok: true, ...data });
const bad = (msg: string, code = 400) =>
  NextResponse.json({ error: msg }, { status: code });

// shared auth helper (must match parent route)
async function gate(slug: string) {
  const hdrs = headers();
  const headerKey = hdrs.get('x-api-key') || '';
  const cookieKey = cookies().get('admin_key')?.value || '';
  const candidateKey = (headerKey || cookieKey || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      organizer: { select: { apiKey: true } },
    },
  });

  if (!event) return { event: null, pass: false };

  const globalKey =
    process.env.NEXT_PUBLIC_ADMIN_KEY ||
    process.env.ADMIN_KEY ||
    '';

  const pass =
    !!candidateKey &&
    (candidateKey === globalKey ||
      candidateKey === event.organizer?.apiKey);

  return { event, pass };
}

// PATCH -> rotate secret OR update station fields
export async function PATCH(
  req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  const { event, pass } = await gate(params.slug);
  if (!event || !pass) return bad('Unauthorized', 401);

  const body = (await req.json().catch(() => null)) as {
    rotateSecret?: boolean;
    name?: string;
    code?: string;
    active?: boolean;
  };

  // ensure station belongs to this event
  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== event.id) return bad('Not found', 404);

  // Rotate secret
  if (body?.rotateSecret) {
    const secret = crypto.randomBytes(24).toString('base64url');
    const secretHash = await hashSecret(secret);
    await prisma.station.update({
      where: { id: st.id },
      data: { secretHash },
    });
    return ok({ secret }); // plaintext once
  }

  // other updates (rename, recode, activate/deactivate)
  const data: Record<string, any> = {};
  if (typeof body?.name === 'string') data.name = body.name.trim();
  if (typeof body?.code === 'string') data.code = body.code.trim();
  if (typeof body?.active === 'boolean') data.active = body.active;

  if (!Object.keys(data).length) return bad('Nothing to update');

  const station = await prisma.station.update({
    where: { id: st.id },
    data,
  });

  return ok({ station });
}

// DELETE -> soft-delete station (set active=false)
export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string; id: string } }
) {
  const { event, pass } = await gate(params.slug);
  if (!event || !pass) return bad('Unauthorized', 401);

  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== event.id) return bad('Not found', 404);

  await prisma.station.update({
    where: { id: st.id },
    data: { active: false },
  });

  return ok({ deleted: true });
}
