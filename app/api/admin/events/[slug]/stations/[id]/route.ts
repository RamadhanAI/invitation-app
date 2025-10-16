// app/api/admin/events/[slug]/stations/[id]/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { hashSecret } from '@/lib/password';

const ok  = (data: any) => NextResponse.json({ ok: true, ...data });
const bad = (msg: string, code = 400) => NextResponse.json({ error: msg }, { status: code });

async function gate(slug: string, apiKey?: string | null) {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { event: null, pass: false };
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || process.env.ADMIN_KEY || '';
  const pass = !!apiKey && (apiKey === adminKey || apiKey === event.organizer?.apiKey);
  return { event, pass };
}

export async function PATCH(req: Request, { params }: { params: { slug: string; id: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  const body = (await req.json().catch(() => null)) as {
    rotateSecret?: boolean;
    name?: string;
    code?: string;
    active?: boolean;
  };

  // Ensure station belongs to this event
  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== event.id) return bad('Not found', 404);

  // Rotate secret
  if (body?.rotateSecret) {
    const secret = crypto.randomBytes(24).toString('base64url');
    const secretHash = await hashSecret(secret); // scrypt
    await prisma.station.update({ where: { id: st.id }, data: { secretHash } });
    return ok({ secret }); // plaintext once
  }

  // Rename / recode / toggle active
  const data: any = {};
  if (typeof body?.name === 'string') data.name = body.name.trim();
  if (typeof body?.code === 'string') data.code = body.code.trim();
  if (typeof body?.active === 'boolean') data.active = body.active;

  if (!Object.keys(data).length) return bad('Nothing to update');
  const station = await prisma.station.update({ where: { id: st.id }, data });
  return ok({ station });
}

export async function DELETE(_: Request, { params }: { params: { slug: string; id: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  // Soft-delete (keep history)
  const st = await prisma.station.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true },
  });
  if (!st || st.eventId !== event.id) return bad('Not found', 404);

  await prisma.station.update({ where: { id: st.id }, data: { active: false } });
  return ok({ deleted: true });
}
