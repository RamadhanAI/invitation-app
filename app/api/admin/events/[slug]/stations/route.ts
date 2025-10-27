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

// Shape the DB row for the UI
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
    // We keep "(inactive)" suffix only if active === false,
    // otherwise just "code: S14"
    apiKeyMasked: `code: ${row.code}${row.active ? '' : ' (inactive)'}`,
    lastUsedAt: null, // placeholder: could add station.lastUsedAt later
    createdAt: row.createdAt.toISOString(),
  };
}

// helper: find eventId by slug
async function getEventIdBySlug(slug: string): Promise<string | null> {
  const ev = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  return ev?.id ?? null;
}

// helper: generate next code like S14, S15, ...
async function pickNextCode(eventId: string): Promise<string> {
  const stations = await prisma.station.findMany({
    where: { eventId },
    select: { code: true },
  });

  // Look for codes like S<number> and pick the max number
  let maxN = 0;
  for (const st of stations) {
    const m = /^S(\d+)$/.exec(st.code);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
  }

  return `S${maxN + 1}`;
}

// GET /api/admin/events/[slug]/stations
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  // auth via cookie
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  const eventId = await getEventIdBySlug(params.slug);
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'event not found' },
      { status: 404 }
    );
  }

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
// body: { name: string }
export async function POST(
  req: Request,
  { params }: { params: { slug: string } }
) {
  // auth
  const adminUser = getAdminUsernameOrNull();
  if (!adminUser) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    );
  }

  const eventId = await getEventIdBySlug(params.slug);
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'event not found' },
      { status: 404 }
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

  const rawName = (body.name ?? body.label ?? '').toString().trim();
  if (!rawName) {
    return NextResponse.json(
      { ok: false, error: 'Missing scanner name' },
      { status: 400 }
    );
  }

  // build code and secret
  try {
    const code = await pickNextCode(eventId);

    const secretPlain = crypto.randomBytes(24).toString('base64url');
    const secretHash = await hashSecret(secretPlain);

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
      secret: secretPlain, // show once for the scanner staff
    });
  } catch (err: any) {
    console.error('[stations:POST] create failed', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Failed to create scanner',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS/preflight if needed
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
