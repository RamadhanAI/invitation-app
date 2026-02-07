// lib/admin-export.ts
import { prisma } from '@/lib/db';
import { resolveEventScope } from '@/lib/resolveEventScope';

/** allow API Key via header, bearer, or ?key= */
function extractProvidedKey(req: Request): string {
  const url = new URL(req.url);
  const q = (url.searchParams.get('key') || '').trim();
  const hdr = (req.headers.get('x-api-key') || '').trim();
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return q || hdr || bearer;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/["\n\r,]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** main handler used by both export routes (singular/plural) */
export async function handleRegistrationsExport(req: Request, slug: string): Promise<Response> {
  // 1) primary auth: signed cookie session (tenant-scoped)
  const scope = await resolveEventScope(req, slug);
  let eventId: string | null = scope.ok ? scope.event.id : null;

  // 2) fallback auth: API key (org key or env admin key)
  if (!eventId) {
    const providedKey = extractProvidedKey(req);
    if (!providedKey) {
      return new Response(JSON.stringify({ error: scope.ok ? 'Unauthorized' : scope.error }), {
        status: scope.ok ? 401 : scope.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, organizer: { select: { apiKey: true } } },
    });
    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }

    const orgKey = (event.organizer?.apiKey || '').trim();
    const envAdminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
    const keyOk = (providedKey === orgKey) || (envAdminKey && providedKey === envAdminKey);
    if (!keyOk) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    eventId = event.id;
  }

  // 3) fetch registrations
  const rows = await prisma.registration.findMany({
    where: { eventId: eventId },
    orderBy: { registeredAt: 'asc' },
    select: {
      id: true,
      email: true,
      price: true,
      paid: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
      qrToken: true,
    },
  });

  // 4) to CSV
  const header = [
    'id','email','price','paid','attended',
    'registeredAt','scannedAt','scannedBy',
    'checkedOutAt','checkedOutBy','qrToken'
  ].join(',');

  const body = rows.map((r: { id: any; email: any; price: any; paid: any; attended: any; registeredAt: any; scannedAt: any; scannedBy: any; checkedOutAt: any; checkedOutBy: any; qrToken: any; }) => [
    r.id, r.email, r.price, r.paid, r.attended,
    r.registeredAt, r.scannedAt, r.scannedBy,
    r.checkedOutAt, r.checkedOutBy, r.qrToken
  ].map(csvEscape).join(','));

  const csv = [header, ...body].join('\n');
  const filename = `registrations-${slug}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
