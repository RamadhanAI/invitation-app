// app/api/admin/events/[slug]/stations/route.ts
// app/api/admin/events/[slug]/stations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminForSlug } from '@/lib/adminAuth';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';

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
    apiKeyMasked: `code: ${row.code}${
      row.active ? '' : ' (inactive)'
    }`,
    lastUsedAt: null, // (placeholder for future analytics)
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/admin/events/[slug]/stations
export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.status }
    );
  }

  const stations = await prisma.station.findMany({
    where: { eventId: gate.eventId },
    orderBy: [{ createdAt: 'asc' }],
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
    stations: stations.map(maskStation),
  });
}

// POST /api/admin/events/[slug]/stations
// body: { name: string }
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const gate = await requireAdminForSlug(req, params.slug);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.status }
    );
  }

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

  const rawName = (body.name ?? body.label ?? '').toString().trim();
  if (!rawName) {
    return NextResponse.json(
      { error: 'Missing scanner name' },
      { status: 400 }
    );
  }

  // pick next code "S<number>"
  const count = await prisma.station.count({
    where: { eventId: gate.eventId },
  });
  const code = `S${count + 1}`;

  // generate secret
  const secretPlain = crypto
    .randomBytes(24)
    .toString('base64url');
  const secretHash = await hashSecret(secretPlain);

  const st = await prisma.station.create({
    data: {
      eventId: gate.eventId,
      name: rawName,
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

  return NextResponse.json({
    ok: true,
    station: maskStation(st),
    secret: secretPlain, // ← show once so you can share with door staff
  });
}

// Preflight
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
