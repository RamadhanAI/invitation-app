// lib/adminAuth.ts
// lib/adminAuth.ts
import 'server-only';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getAdminSession, type SessionPayload } from '@/lib/session';

export function getSessionCookie(): string | undefined {
  return cookies().get('inv_admin')?.value;
}

export function readAdminSessionFromCookies():
  | { ok: true; user: string; role?: string; oid?: string }
  | { ok: false } {
  const sess = getAdminSession();
  if (!sess) return { ok: false };

  return {
    ok: true,
    user: sess.u,
    role: sess.role,
    oid: sess.oid,
  };
}

/**
 * Require an admin session and an event (by slug).
 *
 * Tenant isolation:
 * - Superadmin can access anything.
 * - Non-superadmin must match event.organizerId === sess.oid
 * - Non-superadmin requires organizer.status === 'active'
 */
export async function requireAdminForSlug(slug: string) {
  const sess = getAdminSession();
  if (!sess) return { ok: false as const, error: 'Unauthorized' };

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      organizerId: true,
      organizer: { select: { id: true, apiKey: true, status: true } },
    },
  });

  if (!event) return { ok: false as const, error: 'Event not found' };

  const isSuper = sess.role === 'superadmin';

  if (isSuper) {
    return { ok: true as const, event, session: sess };
  }

  // tenant users must have oid and match organizerId
  if (!sess.oid || !event.organizerId || event.organizerId !== sess.oid) {
    return { ok: false as const, error: 'Forbidden' };
  }

  // tenant must be active
  if (event.organizer?.status !== 'active') {
    return { ok: false as const, error: 'Tenant not active' };
  }

  return { ok: true as const, event, session: sess };
}
