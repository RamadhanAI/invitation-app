// app/api/admin/session/route.ts
// app/api/admin/session/route.ts
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> "am I logged in?"
export async function GET() {
  const sess: any = getAdminSession();
  if (!sess) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    role: sess.role ?? 'admin',
    oid: sess.oid ?? null,
    user: sess.u ?? sess.user ?? null,
    exp: sess.exp ?? null,

    // impersonation extras (optional)
    imp: !!sess.imp,
    impTenantName: sess.impTenantName ?? null,
    impTenantStatus: sess.impTenantStatus ?? null,
  });
}

// Admin login happens elsewhere
export async function POST() {
  return NextResponse.json({ error: 'Login via /api/auth/login' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Use /api/auth/logout' }, { status: 405 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
