export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import * as crypto from 'node:crypto';
// Keep your import, but we'll add a fallback below
import { hashSecret as hashSecretFromLib } from '@/lib/password';

const ok  = (data: any) => NextResponse.json({ ok: true, ...data });
const bad = (msg: string, code = 400) => NextResponse.json({ ok: false, error: msg }, { status: code });

// Fallback hasher if lib/password has issues in prod
async function hashSecret(secret: string): Promise<string> {
  try {
    if (typeof hashSecretFromLib === 'function') {
      return await hashSecretFromLib(secret);
    }
  } catch {}
  const salt = process.env.SECRET_SALT ?? 'station';
  const dk = await new Promise<Buffer>((res, rej) =>
    crypto.scrypt(secret, salt, 64, (err, buf) => (err ? rej(err) : res(buf)))
  );
  return `s:${dk.toString('hex')}`;
}

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

// GET stays the same
export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  const stations = await prisma.station.findMany({
    where: { eventId: event.id, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, code: true, createdAt: true, updatedAt: true, active: true },
  });

  const rows = stations.map((s: { id: any; name: any; code: any; createdAt: any; }) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    createdAt: s.createdAt,
    lastUsedAt: null as string | null,
    apiKeyMasked: `code: ${s.code}`,
  }));

  return ok({ stations: rows });
}

// POST — more defensive, clearer errors, auto-code & secret hash fallback
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const apiKey = headers().get('x-api-key');
  const { event, pass } = await gate(params.slug, apiKey);
  if (!event || !pass) return bad('Unauthorized', 401);

  try {
    const body = (await req.json().catch(() => ({}))) as { name?: string; label?: string; code?: string };
    const name = (body.name || body.label || '').toString().trim();
    let   code = (body.code || '').toString().trim();

    if (!name) return bad('Name required');

    // Auto-generate code S1, S2, ...
    if (!code) {
      const existing = await prisma.station.findMany({
        where: { eventId: event.id },
        select: { code: true },
      });
      const nums = existing
        .map((s: { code: any; }) => /^S(\d+)$/.exec(s.code || '')?.[1])
        .map((n: any) => (n ? Number(n) : NaN))
        .filter(Number.isFinite) as number[];
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      code = `S${next}`;
    }

    // Generate and hash secret
    const secret = crypto.randomBytes(24).toString('base64url');
    const secretHash = await hashSecret(secret);

    const station = await prisma.station.create({
      data: { eventId: event.id, name, code, secretHash, active: true },
      select: { id: true, name: true, code: true, createdAt: true, updatedAt: true },
    });

    return ok({ station, secret });
  } catch (e: any) {
    console.error('[stations:POST] error', e);
    // Surface message to the browser so you can see it in DevTools > Network
    return NextResponse.json({ ok: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}
