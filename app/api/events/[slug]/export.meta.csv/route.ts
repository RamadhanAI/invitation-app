// app/api/events/[slug]/export.meta.csv/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(req: Request, slug: string) {
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearerKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided = (headerKey || bearerKey).trim();

  const devKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };

  const organizerKey = (event.organizer?.apiKey || '').trim();
  const ok = !!provided && (provided === organizerKey || (devKey && provided === devKey));
  return ok ? { ok: true as const, event } : { ok: false as const, status: 401, error: 'Unauthorized' };
}

const esc = (s: any) => {
  const v = (s ?? '').toString();
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const gate = await requireAdmin(req, params.slug);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const regs = await prisma.registration.findMany({
    where: { eventId: gate.event.id },
    orderBy: { registeredAt: 'desc' },
    select: { id: true, email: true, meta: true },
  });

  // Collect dynamic meta keys across rows
  const keySet = new Set<string>();
  const rows: Record<string, any>[] = [];
  for (const r of regs) {
    let m: Record<string, any> = {};
    try { m = typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta as any) || {}; } catch {}
    rows.push({ id: r.id, email: r.email, ...m });
    Object.keys(m).forEach(k => keySet.add(k));
  }
  const keys = ['id','email', ...Array.from(keySet).sort()];
  const header = keys.join(',');
  const body = rows.map(row => keys.map(k => esc(row[k])).join(',')).join('\n');
  const csv = header + '\n' + body;

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${params.slug}-meta.csv"`,
      'cache-control': 'no-store',
    },
  });
}
