// lib/adminAuth.ts
import { prisma } from '@/lib/db';

export type GateResult =
  | { ok: true; eventId: string }
  | { ok: false; status: number; error: string };

export async function requireAdminForSlug(req: Request, slug: string): Promise<GateResult> {
  const url = new URL(req.url);
  const qp = (url.searchParams.get('x-api-key') ?? '').trim();
  const headerKey = (req.headers.get('x-api-key') ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  const bearerKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided = (qp || headerKey || bearerKey).trim();

  const adminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false, status: 404, error: 'Event not found' };

  const orgKey = (event.organizer?.apiKey || '').trim();
  const ok = !!provided && (provided === orgKey || (!!adminKey && provided === adminKey));
  if (!ok) return { ok: false, status: 401, error: 'Unauthorized' };

  return { ok: true, eventId: event.id };
}
