// app/api/admin/events/[slug]/registration/import/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Papa from 'papaparse';
import * as crypto from 'node:crypto';
import { resolveEventScope } from '@/lib/resolveEventScope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ───────── small helpers
function normalizeEmail(v: unknown) {
  return String(v ?? '').trim().toLowerCase();
}
function isFiniteNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildMeta(r: Record<string, any>) {
  return {
    firstName: r.firstName ?? r.givenName ?? '',
    lastName: r.lastName ?? r.familyName ?? '',
    companyName: r.companyName ?? r.company ?? '',
    jobTitle: r.jobTitle ?? r.title ?? '',
    ...r, // keep original columns for export/debug
  };
}

function parseCsv(text: string) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    const details = parsed.errors.slice(0, 3);
    return { ok: false as const, error: 'CSV parse error', details };
  }
  return { ok: true as const, rows: (parsed.data || []) as any[] };
}

async function readBody(
  req: Request
): Promise<{ ok: true; rows: any[] } | { ok: false; error: string; details?: any }> {
  const ct = req.headers.get('content-type') || '';

  // multipart: file upload (name="file")
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    if (!file) return { ok: false, error: 'No file field named "file"' };
    const buf = Buffer.from(await file.arrayBuffer());
    const text = new TextDecoder('utf-8').decode(buf);
    const p = parseCsv(text);
    return p.ok ? { ok: true, rows: p.rows } : p;
  }

  // JSON (array or {rows: [...]})
  if (ct.includes('application/json')) {
    const json = await req.json().catch(() => null);
    const rows = Array.isArray(json) ? json : (json as any)?.rows;
    if (!rows || !Array.isArray(rows)) {
      return { ok: false, error: 'Invalid JSON. Expect array or {rows: [...]}' };
    }
    return { ok: true, rows };
  }

  // text/csv or text/plain
  const text = await req.text();
  const p = parseCsv(text);
  return p.ok ? { ok: true, rows: p.rows } : p;
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const scope = await resolveEventScope(req, params.slug);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  // we need price for defaults
  const event = await prisma.event.findUnique({
    where: { id: scope.event.id },
    select: { id: true, price: true },
  });
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const body = await readBody(req);
  if (!body.ok) {
    return NextResponse.json({ error: body.error, details: body.details }, { status: 400 });
  }

  const rows = body.rows;
  if (!rows?.length) return NextResponse.json({ error: 'No rows' }, { status: 400 });

  // normalize → { email, price, meta, qrToken? }
  const errors: { row: number; error: string }[] = [];
  const normalized: { email: string; price: number; meta: any; qrToken?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? {};
    const email = normalizeEmail((r as any).email);
    if (!email) {
      errors.push({ row: i + 2, error: 'Missing email' }); // +2: header + 1-indexed
      continue;
    }
    const price = isFiniteNumber((r as any).price) ?? (typeof event.price === 'number' ? event.price : 0);
    const meta = buildMeta(r as any);
    const qrToken = (r as any).qrToken ? String((r as any).qrToken) : undefined;

    normalized.push({ email, price, meta, qrToken });
  }

  // intra-CSV dedupe (last one wins)
  const byEmail = new Map<string, { email: string; price: number; meta: any; qrToken?: string }>();
  for (const item of normalized) byEmail.set(item.email, item);
  const uniqueRows = Array.from(byEmail.values());

  // fetch existing once
  const existing = await prisma.registration.findMany({
    where: { eventId: event.id, email: { in: uniqueRows.map(r => r.email) } },
    select: { id: true, email: true },
  });
  const existingEmails = new Set(existing.map(x => x.email));

  const toCreate = uniqueRows.filter(r => !existingEmails.has(r.email));
  const toUpdate = uniqueRows.filter(r => existingEmails.has(r.email));

  // createMany (fast) with generated tokens; honor supplied qrToken if present
  const createData = toCreate.map(r => ({
    eventId: event.id,
    email: r.email,
    price: Math.round(r.price || 0),
    paid: !!(r.price === 0),
    qrToken: r.qrToken ?? crypto.randomUUID(),
    registeredAt: new Date(),
    attended: false,
    scannedAt: null as Date | null,
    scannedBy: null as string | null,
    meta: r.meta,
  }));

  let created = 0;
  if (createData.length) {
    // chunk to avoid parameter limits
    const CHUNK = 1000;
    for (let i = 0; i < createData.length; i += CHUNK) {
      const part = createData.slice(i, i + CHUNK);
      const res = await prisma.registration.createMany({ data: part, skipDuplicates: true });
      created += res.count;
    }
  }

  // update meta for existing (chunked)
  let updated = 0;
  if (toUpdate.length) {
    const existingByEmail = new Map(existing.map(e => [e.email, e.id] as const));
    const CHUNK = 250;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const part = toUpdate.slice(i, i + CHUNK);
      await prisma.$transaction(
        part.map(r =>
          prisma.registration.update({
            where: { id: existingByEmail.get(r.email)! },
            data: { meta: r.meta },
          })
        )
      );
      updated += part.length;
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      parsed: rows.length,
      created,
      updated,
      duplicates: uniqueRows.length - toCreate.length - toUpdate.length,
      errors,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
