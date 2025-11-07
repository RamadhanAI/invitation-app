// lib/db.ts
import { PrismaClient, Prisma } from '@prisma/client';

// --- Stable Prisma singleton across hot reloads ---
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Dev-friendly logging without spam; enable query logs only if you want.
const logs: Prisma.LogLevel[] =
  process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'];

if (process.env.PRISMA_LOG_QUERIES === '1') logs.unshift('query');

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logs,
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ---- Helpers ----
export type AttendanceSummary = { total: number; attended: number; noShows: number };
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [k: string]: JsonValue } | JsonValue[];

/** Fetch registrations for an event (ordered by first registered). */
export async function getRegistrations(eventId: string) {
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
  });
}

/** Quick counts for dashboard widgets. */
export async function getAttendance(eventId: string): Promise<AttendanceSummary> {
  const total = await prisma.registration.count({ where: { eventId } });
  const attended = await prisma.registration.count({ where: { eventId, attended: true } });
  return { total, attended, noShows: Math.max(0, total - attended) };
}

/** Toggle attended by QR token (scanner flow). */
export async function markAttendanceByToken(qrToken: string) {
  return prisma.registration.update({
    where: { qrToken },
    data: { attended: true, scannedAt: new Date() },
  });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({ where: { slug } });
}

/** Health check you can call from /api/health. */
export async function pingDb() {
  try {
    const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
    return { ok: true as const, now: row?.now ?? new Date() };
  } catch (e: unknown) {
    return { ok: false as const, error: String((e as any)?.message || e) };
  }
}

export default prisma;
