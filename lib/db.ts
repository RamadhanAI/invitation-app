// lib/db.ts
// lib/db.ts (filled helpers; preserves your pooler-first logic)
import { PrismaClient } from '@prisma/client';

let loggedOnce = false;

// Local JSON type (avoids Prisma JsonValue differences across versions)
type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [k: string]: JsonValue } | JsonValue[];

// In the **app runtime** we always use the pooler (DATABASE_URL).
if (process.env.PRISMA_USE_DIRECT) {
  if (!loggedOnce) {
    console.warn('[DB] Ignoring PRISMA_USE_DIRECT in app runtime (using DATABASE_URL pooler).');
    loggedOnce = true;
  }
  delete (process.env as any).PRISMA_USE_DIRECT;
}

function resolveDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (!loggedOnce) {
      console.warn('[DB] DATABASE_URL is not set. Prisma will fail to connect.');
      loggedOnce = true;
    }
    return url;
  }

  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port || '5432';
    const params = u.searchParams;
    const isPooler = /pooler\.supabase\.com$/i.test(host);

    if (!loggedOnce && process.env.NODE_ENV !== 'production') {
      console.log(`[DB] Using ${host}:${port}${u.search || ''}`);
      if (!isPooler) {
        console.warn('[DB] WARNING: DATABASE_URL is not a Supabase pooler host. Use the pooler for app runtime.');
      }
      if (isPooler && params.get('pgbouncer') !== 'true') {
        console.warn('[DB] WARNING: Pooler URL without ?pgbouncer=true — add it so Prisma disables prepared statements.');
      }
      loggedOnce = true;
    }
  } catch {
    // ignore parse errors
  }
  return url;
}

const prismaClientSingleton = () =>
  new PrismaClient({
    datasources: { db: { url: resolveDbUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'colorless',
  });

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Export hot-reload safe client
export const prisma: PrismaClient = globalThis.__prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma;

// =============================
// Helper types
// =============================
export type AttendanceSummary = { total: number; attended: number; noShows: number };
export type RegistrationLite = {
  id: string;
  email: string;
  attended: boolean;
  registeredAt: Date | null;
  scannedAt: Date | null;
  scannedBy: string | null;
  checkedOutAt: Date | null;
  checkedOutBy: string | null;
  qrToken: string;
  meta: JsonValue | null;
};

// =============================
// Implementations
// =============================
export async function getRegistrations(eventId: string): Promise<RegistrationLite[]> {
  return prisma.registration.findMany({
    where: { eventId },
    orderBy: [{ registeredAt: 'asc' }],
    select: {
      id: true,
      email: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
      qrToken: true,
      meta: true,
    },
  }) as unknown as RegistrationLite[];
}

export async function getAttendance(eventId: string): Promise<AttendanceSummary> {
  const total = await prisma.registration.count({ where: { eventId } });
  const attended = await prisma.registration.count({ where: { eventId, attended: true } });
  return { total, attended, noShows: Math.max(0, total - attended) };
}

export async function markAttendanceByToken(qrToken: string) {
  // qrToken is globally unique in your schema
  const now = new Date();
  return prisma.registration.update({
    where: { qrToken },
    data: { attended: true, scannedAt: now },
  });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
  });
}

export async function pingDb() {
  try {
    const [row] = await prisma.$queryRaw<{ now: Date }[]>`select now() as now`;
    return { ok: true as const, now: row?.now ?? new Date() };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

export default prisma;
