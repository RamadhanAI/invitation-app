// app/api/events/[slug]/export.csv/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(req: Request, slug: string) {
  const provided = (req.headers.get('x-api-key') || '').trim();
  const devKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true, organizer: { select: { apiKey: true } } } });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };
  const ok = (!!provided && provided === (event.organizer?.apiKey || '')) || (!!devKey && provided === devKey);
  return ok ? { ok: true as const, event } : { ok: false as const, status: 401, error: 'Unauthorized' };
}

const esc = (s: any) => { const v = (s ?? '').toString(); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const gate = await requireAdmin(req, params.slug);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const regs = await prisma.registration.findMany({
    where: { eventId: gate.event.id },
    orderBy: { registeredAt: 'desc' },
    select: {
      email: true, paid: true, attended: true,
      registeredAt: true, scannedAt: true, scannedBy: true,
      qrToken: true, meta: true
    },
  });

  // Collect dynamic meta keys
  const keySet = new Set<string>();
  const rows: Record<string, any>[] = [];
  for (const r of regs) {
    let m: Record<string, any> = {};
    try { m = typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta as any) || {}; } catch {}
    Object.keys(m).forEach(k => keySet.add(k));
    rows.push({ ...r, ...m });
  }
  const metaKeys = Array.from(keySet).sort();

  const header = [
    'email', 'paid', 'attended', 'registeredAt', 'scannedAt', 'scannedBy', 'qrToken',
    ...metaKeys
  ];
  const body = rows.map(row => header.map(k => esc(row[k])).join(',')).join('\n');
  const csv = header.join(',') + '\n' + body;

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${params.slug}-registrations.csv"`,
      'cache-control': 'no-store',
    },
  });
}
