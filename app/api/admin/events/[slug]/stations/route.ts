// app/api/admin/events/[slug]/stations/route.ts
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

// -----------------------------------------------------------------------------
// shared auth helper
// This allows either a global admin key or the event organizer's apiKey.
// We accept the key either via x-api-key header or via the admin_key cookie.
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// GET /api/admin/events/[slug]/stations
// Returns list of stations for this event.
// Shape matches what AdminStationsClient.tsx expects.
// -----------------------------------------------------------------------------
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
      // NOTE: we are NOT selecting lastUsedAt anymore because
      // that column doesn't exist in your current schema.
    },
  });

  // Shape it how AdminStationsClient.tsx expects.
  // We still return lastUsedAt, but we synthesize it as null for now.
  const rows = stations.map((s) => ({
    id: s.id,
    name: s.name,
    apiKeyMasked: `code: ${s.code}${s.active ? '' : ' (inactive)'}`,
    lastUsedAt: null as string | null, // <-- no column in DB yet, so always null
    createdAt: s.createdAt.toISOString(),
  }));

  return ok({ stations: rows });
}

// -----------------------------------------------------------------------------
// POST /api/admin/events/[slug]/stations
// Body: { name: "Scanner 1" } (AdminStationsClient also sends {label})
//
// 1. We generate a code like "S1", "S2", ...
// 2. We generate a new secret for that station.
// 3. We hash the secret with scrypt.
// 4. We store the hash in DB.
// 5. We return the plaintext secret ONCE so the admin can copy it.
// -----------------------------------------------------------------------------
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const { event, pass } = await gate(params.slug);
  if (!event || !pass) return bad('Unauthorized', 401);

  const body = await req.json().catch(() => ({} as any));
  const label = (body.name ?? body.label ?? '').trim();
  if (!label) return bad('Missing station name');

  // Generate station.code like "S1", "S2", ...
  const count = await prisma.station.count({
    where: { eventId: event.id },
  });
  const code = `S${count + 1}`;

  // Generate a fresh one-time secret
  const secretPlain = crypto.randomBytes(24).toString('base64url');
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
    secret: secretPlain, // <-- show this once in AdminStationsClient
  });
}
