// app/api/health/route.ts
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const useDirect = process.env.PRISMA_USE_DIRECT === '1' && !!process.env.DIRECT_URL;
  const u = new URL((useDirect ? process.env.DIRECT_URL! : process.env.DATABASE_URL!) || 'postgres://x');
  try {
    const rows = await prisma.$queryRaw<{ now: Date }[]>`select now() as now`;
    return NextResponse.json({
      ok: true,
      usingDirect: useDirect,
      db: { host: u.hostname, port: u.port, search: u.search },
      now: rows?.[0]?.now ?? null,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      usingDirect: useDirect,
      db: { host: u.hostname, port: u.port, search: u.search },
      error: String(e?.message || e),
    }, { status: 500, headers: { 'cache-control': 'no-store' } });
  }
}
