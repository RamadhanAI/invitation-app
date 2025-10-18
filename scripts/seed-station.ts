// scripts/seed-station.ts
import { prisma } from '@/lib/db';
import { hashSecret } from '@/lib/password';

async function main() {
  const slug   = process.argv[2];
  const code   = process.argv[3];
  const name   = process.argv[4];
  const secret = process.argv[5];

  if (!slug || !code || !name || !secret) {
    console.error('Usage: tsx scripts/seed-station.ts <event-slug> <code> "<name>" <secret>');
    process.exit(1);
  }

  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) throw new Error(`Event not found for slug: ${slug}`);

  const secretHash = await hashSecret(secret);

  const station = await prisma.station.upsert({
    where: { station_event_code: { eventId: event.id, code } },
    update: { name },
    create: {
      eventId: event.id,
      name,
      code,
      secretHash,
      active: true,
    },
  });

  console.log('OK:', { eventId: event.id, stationId: station.id, code, name });
}

main().finally(() => prisma.$disconnect());
