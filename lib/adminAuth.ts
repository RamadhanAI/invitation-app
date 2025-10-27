// lib/adminAuth.ts
import { prisma } from '@/lib/db';
import { getSessionCookie, verifyToken } from '@/lib/auth';
import { headers } from 'next/headers';

export type GateResult =
  | { ok: true; eventId: string }
  | { ok: false; status: number; error: string };

/**
 * Read & verify the admin cookie ("inv_admin") that /api/auth/login creates.
 * Returns { user, exp } if valid, otherwise null.
 */
export function readAdminSessionFromCookies():
  | { user: string; exp: number }
  | null {
  const raw = getSessionCookie('admin'); // from lib/auth.ts
  const secret = process.env.SESSION_SECRET || 'change-me';

  const v = verifyToken(raw, secret);
  if (!v.ok) return null;

  const p: any = v.payload || {};
  if (p.k !== 'admin') return null;
  if (typeof p.u !== 'string') return null;
  if (typeof p.exp !== 'number') return null;

  return { user: p.u, exp: p.exp };
}

/**
 * Require admin access for a given event slug.
 *
 * Order:
 *  1. allow if valid admin cookie
 *  2. else allow if legacy key (organizer apiKey OR global ADMIN_KEY)
 */
export async function requireAdminForSlug(
  req: Request,
  slug: string
): Promise<GateResult> {
  // fetch event (need eventId anyway)
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      organizer: { select: { apiKey: true } },
    },
  });
  if (!event) {
    return { ok: false, status: 404, error: 'Event not found' };
  }

  // 1. Cookie-based admin session?
  const sess = readAdminSessionFromCookies();
  if (sess) {
    return { ok: true, eventId: event.id };
  }

  // 2. Fallback legacy header / query key (for old scripts / scanners if needed)
  const hdrs = headers();
  const url = new URL(req.url);

  const qp1 = (url.searchParams.get('x-api-key') ?? '').trim();
  const qp2 = (url.searchParams.get('key') ?? '').trim();

  const headerKey = (hdrs.get('x-api-key') ?? '').trim();

  const auth = hdrs.get('authorization') ?? '';
  const bearerKey = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : '';

  const provided = (qp1 || qp2 || headerKey || bearerKey).trim();

  const globalAdminKey =
    (process.env.ADMIN_KEY ||
      process.env.NEXT_PUBLIC_ADMIN_KEY ||
      '').trim();

  const orgKey = (event.organizer?.apiKey || '').trim();

  const allowed =
    !!provided &&
    (provided === orgKey ||
      (!!globalAdminKey && provided === globalAdminKey));

  if (!allowed) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true, eventId: event.id };
}
