// lib/adminSession.ts
import { getAdminSession as getSess } from './session';

export function getAdminSession() {
  const p = getSess();
  if (!p) return { ok: false as const };
  return {
    ok: true as const,
    user: p.u,
    exp: p.exp,
    role: p.role,
    oid: p.oid,
  };
}
