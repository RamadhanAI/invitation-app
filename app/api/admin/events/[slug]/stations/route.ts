// app/api/admin/events/[slug]/stations/route.ts
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

// List stations for this event
export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  const stations = await prisma.station.findMany({
    where: { eventId: event.id, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, code: true, createdAt: true, updatedAt: true, active: true },
  });

  const rows = stations.map(s => ({
    id: s.id,
    name: s.name,
    code: s.code,
    createdAt: s.createdAt,
    lastUsedAt: null as string | null,   // (not tracked)
    apiKeyMasked: `code: ${s.code}`,     // never return secret
  }));

  return ok({ stations: rows });
}

// Create a station (returns plaintext secret ONCE)
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  const body = (await req.json().catch(() => null)) as { name?: string; code?: string };
  const name = (body?.name ?? '').trim();
  let   code = (body?.code ?? '').trim();
  if (!name) return bad('Name required');

  // Auto-generate a code if not provided (S1, S2, …)
  if (!code) {
    const existing = await prisma.station.findMany({
      where: { eventId: event.id },
      select: { code: true },
    });
    const nums = existing
      .map(s => s.code.match(/^S(\d+)$/)?.[1])
      .filter(Boolean)
      .map(n => parseInt(n!, 10));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    code = `S${next}`;
  }

  // Create a random secret and store its hash (scrypt)
  const secret = crypto.randomBytes(24).toString('base64url');
  const secretHash = await hashSecret(secret);

  const station = await prisma.station.create({
    data: { eventId: event.id, name, code, secretHash, active: true },
    select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
  });

  // Return plaintext secret ONCE so admin can copy/share
  return ok({ station, secret });
}
