// app/api/admin/events/[slug]/stations/route.ts
// app/api/admin/events/[slug]/stations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';
import { getAdminUsernameOrNull } from '@/lib/adminSession';

// Take the DB row and shape it for the UI table
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
    lastUsedAt: null, // placeholder until you track last scan usage
    createdAt: row.createdAt.toISOString(),
  };
}

// Utility: get eventId from slug or return null
async function getEventIdBySlug(slug: string): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  return event?.id ?? null;
}

// GET /api/admin/events/[slug]/stations
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  // 1. auth via inv_admin cookie only
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  // 2. find event by slug
  const eventId = await getEventIdBySlug(params.slug);
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'event not found' },
      { status: 404 }
    );
  }

  // 3. read stations
  const stations = await prisma.station.findMany({
    where: { eventId },
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
    items: stations.map(maskStation),
  });
}

// POST /api/admin/events/[slug]/stations
// body: { name: string, code?: string }
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  // 1. auth via cookie
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  // 2. event lookup
  const eventId = await getEventIdBySlug(params.slug);
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'event not found' },
      { status: 404 }
    );
  }

  // 3. parse body
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
      { ok: false, error: 'Missing scanner name' },
      { status: 400 }
    );
  }

  // if caller sent an explicit code, honor it. otherwise auto "S<number>"
  let code = (body.code ?? '').toString().trim();
  if (!code) {
    const count = await prisma.station.count({
      where: { eventId },
    });
    code = `S${count + 1}`;
  }

  // generate and hash secret
  const secretPlain = crypto.randomBytes(24).toString('base64url');
  const secretHash = await hashSecret(secretPlain);

  // create station
  const st = await prisma.station.create({
    data: {
      eventId,
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
    // VERY IMPORTANT: we return this plaintext once so staff can copy it
    secret: secretPlain,
  });
}

// OPTIONS is here for CORS/preflight safety (esp. if you ever hit this from another origin)
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
