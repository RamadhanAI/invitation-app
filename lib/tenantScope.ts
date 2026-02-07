import 'server-only';
import { redirect } from 'next/navigation';
import type { SessionPayload } from '@/lib/session';

export function requireAdminTenant(sess: SessionPayload | null, nextPath = '/admin') {
  if (!sess) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  const isSuper = sess.role === 'superadmin';
  if (!isSuper && !sess.oid) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return { isSuper, oid: sess.oid || null };
}

export function scopeWhere(isSuper: boolean, oid: string | null) {
  return isSuper ? {} : { organizerId: oid! };
}
