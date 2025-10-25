// app/api/admin/events/[slug]/stations/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';

const ok = (data: any) => NextResponse.json({ ok: true, ...data });
const bad = (msg: string, code = 400) =>
  NextResponse.json({ error: msg }, { status: code });

// generate a URL-safe secret without relying on .toString('base64url')
function generatePlainSecret() {
  return crypto
    .randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

// auth gate: accept either x-api-key header OR the admin_key cookie
async function gate(slug: string) {
  const hdrs = headers();
  const headerKey = hdrs.get('x-api-key') || '';
  const cookieKey = cookies().get('admin_key')?.value || '';
  const candidateKey = (headerKey || cookieKey || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { event: null, pass: false };

  const globalKey = (process.env.NEXT_PUBLIC_ADMIN_KEY ||
    process.env.ADMIN_KEY ||
    ''
  ).trim();

  const pass =
    !!candidateKey &&
    (candidateKey === globalKey ||
      candidateKey === (event.organizer?.apiKey || ''));

  return { event, pass };
}

// GET /api/admin/events/[slug]/stations
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const { event, pass } = await gate(params.slug);
  if (!event || !pass) return bad('Unauthorized', 401);

  const stations = await prisma.station.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      createdAt: true,
    },
  });

  const rows = stations.map((s) => ({
    id: s.id,
    name: s.name,
    apiKeyMasked: `code: ${s.code}${s.active ? '' : ' (inactive)'}`,
    lastUsedAt: null as string | null, // you don't track this yet
    createdAt: s.createdAt.toISOString(),
  }));

  return ok({ stations: rows });
}

// POST /api/admin/events/[slug]/stations
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { event, pass } = await gate(params.slug);
  if (!event || !pass) return bad('Unauthorized', 401);

  const body = await req.json().catch(() => ({} as any));
  const label = (body.name ?? body.label ?? '').trim();
  if (!label) return bad('Missing station name');

  // choose next code like "S1", "S2", ...
  const count = await prisma.station.count({
    where: { eventId: event.id },
  });
  const code = `S${count + 1}`;

  // new one-time secret
  const secretPlain = generatePlainSecret();
  const secretHash = await hashSecret(secretPlain);

  const station = await prisma.station.create({
    data: {
      eventId: event.id,
      name: label,
      code,
      secretHash,
      active: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      createdAt: true,
    },
  });

  return ok({
    station: {
      id: station.id,
      name: station.name,
      code: station.code,
      active: station.active,
      createdAt: station.createdAt.toISOString(),
    },
    // plaintext secret only comes back once
    secret: secretPlain,
  });
}
