// scripts/seed-station.ts
// scripts/seed-station.ts
import { prisma } from '@/lib/db';
import { hashSecret } from '@/lib/password';

/**
 * Usage:
 *   tsx scripts/seed-station.ts <event-slug> <code> "<name>" <secret>
 *
 * Example:
 *   tsx scripts/seed-station.ts prime-expo-2025 S1 "Gate 1 — Ahmed" superSecret123
 *
 * Behavior:
 *   - If station with (eventId, code) exists:
 *        * updates its name
 *        * updates its secretHash to the NEW secret you passed
 *        * forces active=true
 *   - Otherwise:
 *        * creates a new active station with that code, name, and secret
 *
 * After running:
 *   Give the <secret> (plaintext) to that gate device.
 *   In /scan they paste that secret + choose event slug.
 *   That device can now check people in.
 */

async function main() {
  const slug   = process.argv[2];
  const code   = process.argv[3];
  const name   = process.argv[4];
  const secret = process.argv[5];

  if (!slug || !code || !name || !secret) {
    console.error('Usage: tsx scripts/seed-station.ts <event-slug> <code> "<name>" <secret>');
    process.exit(1);
  }

  // 1. Find the event by slug
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true },
  });

  if (!event) {
    throw new Error(`Event not found for slug: ${slug}`);
  }

  // 2. Hash the provided secret (scrypt/bcrypt via hashSecret)
  const secretHash = await hashSecret(secret);

  // 3. Upsert station on (eventId, code)
  const station = await prisma.station.upsert({
    where: {
      station_event_code: {
        eventId: event.id,
        code,
      },
    },
    update: {
      name,
      secretHash,
      active: true,
    },
    create: {
      eventId: event.id,
      name,
      code,
      secretHash,
      active: true,
    },
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      eventId: true,
    },
  });

  // 4. Output summary for operator
  console.log('OK seed/rotate station:');
  console.log({
    eventSlug: event.slug,
    eventId: event.id,
    stationId: station.id,
    code: station.code,
    name: station.name,
    active: station.active,
    // we intentionally DO NOT print the hash, only the plaintext secret
    // because plaintext secret is what door staff needs
    useThisScannerSecretInScanPage: secret,
  });
}

// Make sure Prisma disconnects cleanly
main()
  .catch((err) => {
    console.error('seed-station ERROR:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
