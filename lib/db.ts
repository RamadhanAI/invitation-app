// lib/db.ts
import { PrismaClient } from '@prisma/client';

// Singleton guard (avoids hot-reload multiple connections)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ---- Helpers ----
export type AttendanceSummary = { total: number; attended: number; noShows: number };
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [k: string]: JsonValue } | JsonValue[];

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

export async function getAttendance(eventId: string): Promise<AttendanceSummary> {
  const total = await prisma.registration.count({ where: { eventId } });
  const attended = await prisma.registration.count({ where: { eventId, attended: true } });
  return { total, attended, noShows: Math.max(0, total - attended) };
}

export async function markAttendanceByToken(qrToken: string) {
  return prisma.registration.update({
    where: { qrToken },
    data: { attended: true, scannedAt: new Date() },
  });
}

export async function getEventBySlug(slug: string) {
  return prisma.event.findUnique({ where: { slug } });
}

export async function pingDb() {
  try {
    const [row] = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() AS now`;
    return { ok: true as const, now: row?.now ?? new Date() };
  } catch (e: any) {
    return { ok: false as const, error: String(e?.message || e) };
  }
}

export default prisma;
