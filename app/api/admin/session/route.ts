// app/api/admin/session/route.ts
// app/api/admin/session/route.ts
import { NextResponse } from 'next/server';
import { readAdminSessionFromCookies } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET  -> "am I logged in as admin?"
// Used by AdminStationsClient to gate UI before loading data.
export async function GET() {
  const sess = readAdminSessionFromCookies();
  if (!sess) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  return NextResponse.json({
    ok: true,
    user: sess.user,
    exp: sess.exp,
  });
}

// We no longer POST admin keys here. Admin login happens at /api/auth/login
export async function POST() {
  return NextResponse.json(
    { error: 'Login via /api/auth/login' },
    { status: 405 }
  );
}

// Optional: we’re not clearing here,
// logout is handled by /api/auth/logout or clearSession('admin') if you expose that.
export async function DELETE() {
  return NextResponse.json(
    { error: 'Use /api/auth/logout' },
    { status: 405 }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
