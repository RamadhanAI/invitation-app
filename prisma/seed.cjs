// prisma/seed.cjs
/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function apiKey() {
  return crypto.randomBytes(24).toString('hex');
}

// Simple helpers
const utc = (d) => new Date(d);

async function main() {
  // 1) Organizer
  const organizer = await prisma.organizer.upsert({
    where: { email: 'owner@demo-events.test' },
    update: {},
    create: {
      name: 'Demo Events',
      email: 'owner@demo-events.test',
      apiKey: apiKey(),
      brand: {
        emailFromName: 'Demo Events',
        primary: '#111827',
        secondary: '#9aa3af',
        button: '#2e5fff',
        logoUrl: 'https://dummyimage.com/200x64/111827/ffffff&text=Demo+Events'
      },
      users: {
        create: [
          { email: 'admin@demo-events.test', role: 'admin' },
          { email: 'scanner@demo-events.test', role: 'scanner' },
        ]
      }
    }
  });

  // 2) Event Templates (3)
  const templates = await Promise.all([
    prisma.eventTemplate.upsert({
      where: { name: 'Trade Expo (Free)' },
      update: {},
      create: {
        name: 'Trade Expo (Free)',
        description: 'Large trade exhibition with free registration.',
        defaults: {
          fields: {
            nationality: true,
            designationLevel: true,
            jobTitle: true,
            mobile: true,
            country: true,
            companyName: true,
            companyCategory: true,
            companyIndustry: true,
            department: true,
            interests: [
              'Food & Beverages',
              'Non-Food',
              'Brand Development & Services'
            ],
            coLocatedInterest: true,
            terms: true,
            marketingOptIn: true,
            ageConfirm21: true
          },
          badgeCategory: 'VISITOR'
        }
      }
    }),
    prisma.eventTemplate.upsert({
      where: { name: 'Conference (Paid)' },
      update: {},
      create: {
        name: 'Conference (Paid)',
        description: 'Paid conference with Stripe checkout.',
        defaults: {
          priceCents: 19900,
          currency: 'USD',
          badgeCategory: 'DELEGATE'
        }
      }
    }),
    prisma.eventTemplate.upsert({
      where: { name: 'Workshop (RSVP)' },
      update: {},
      create: {
        name: 'Workshop (RSVP)',
        description: 'Limited seats, RSVP-only workshop.',
        defaults: {
          capacity: 60,
          badgeCategory: 'ATTENDEE'
        }
      }
    }),
  ]);

  // 3) One sample Event using template #1
  const event = await prisma.event.upsert({
    where: { slug: 'prime-expo-2025' },
    update: {},
    create: {
      slug: 'prime-expo-2025',
      title: 'PRIME EXPO 2025',
      description:
        'The region’s largest private label trade show. Free for trade professionals.',
      date: utc('2025-11-18T10:00:00Z'),
      venue: 'Dubai World Trade Centre, Halls 4–6',
      price: 0,
      currency: 'USD',
      capacity: 50000,
      organizerId: organizer.id,
    }
  });

  console.log('Seed complete.');
  console.table({
    Organizer: organizer.email,
    API_KEY: organizer.apiKey,
    Event: event.slug,
    Templates: templates.length
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
