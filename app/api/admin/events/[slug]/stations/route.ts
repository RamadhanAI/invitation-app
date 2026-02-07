// app/api/admin/events/[slug]/stations/route.ts
// app/api/admin/events/[slug]/stations/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as crypto from 'node:crypto';
import { hashSecret } from '@/lib/password';
import { resolveEventScope } from '@/lib/resolveEventScope';

function maskStation(row: { id: string; name: string; code: string; active: boolean; createdAt: Date }) {
  return {
    id: row.id,
    name: row.name,
    apiKeyMasked: `code: ${row.code}${row.active ? '' : ' (inactive)'}`,
    lastUsedAt: null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function pickNextCode(eventId: string): Promise<string> {
  const stations = await prisma.station.findMany({ where: { eventId }, select: { code: true } });
  let maxN = 0;
  for (const st of stations) {
    const m = /^S(\d+)$/.exec(st.code);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `S${maxN + 1}`;
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  // stations should be session-managed; if you want key-mode too, remove this check.
  if (scope.mode !== 'session') return NextResponse.json({ ok: false, error: 'Session required' }, { status: 401 });

  const stations = await prisma.station.findMany({
    where: { eventId: scope.eventId },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, name: true, code: true, active: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, items: stations.map(maskStation) });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  if (scope.mode !== 'session') return NextResponse.json({ ok: false, error: 'Session required' }, { status: 401 });

  let body: any = {};
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) body = await req.json().catch(() => ({}));
  else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }

  const rawName = (body.name ?? body.label ?? '').toString().trim();
  if (!rawName) return NextResponse.json({ ok: false, error: 'Missing scanner name' }, { status: 400 });

  try {
    const code = await pickNextCode(scope.eventId);
    const secretPlain = crypto.randomBytes(24).toString('base64url');
    const secretHash = await hashSecret(secretPlain);

    const st = await prisma.station.create({
      data: { eventId: scope.eventId, name: rawName, code, secretHash, active: true },
      select: { id: true, name: true, code: true, active: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, station: maskStation(st), secret: secretPlain });
  } catch (err: any) {
    console.error('[stations:POST] create failed', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Failed to create scanner' }, { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
