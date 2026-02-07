// prisma/seed.cjs
/* eslint-disable */
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function apiKey() {
  return crypto.randomBytes(24).toString("base64url");
}

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

async function hashPassword(plain) {
  const rounds = parseInt(process.env.SEED_BCRYPT_ROUNDS || "10", 10);
  return await bcrypt.hash(String(plain), rounds);
}

const utc = (d) => new Date(d);

async function main() {
  // -------------------------
  // 1) Organizer
  // -------------------------
  const ORG_EMAIL = env("SEED_ORG_EMAIL", "owner@demo-events.test");
  const ORG_NAME = env("SEED_ORG_NAME", "Demo Events");
  const ORG_API_KEY = env("SEED_ORG_API_KEY", apiKey());

  const organizer = await prisma.organizer.upsert({
    where: { email: ORG_EMAIL },
    update: {
      name: ORG_NAME,
      apiKey: ORG_API_KEY,
      status: "active",
      brand: {
        emailFromName: ORG_NAME,
        primary: "#111827",
        secondary: "#9aa3af",
        button: "#2e5fff",
        headerBlue: "#1D4ED8",
        cta: "#B7E000",
        logoUrl:
          "https://dummyimage.com/200x64/111827/ffffff&text=Demo+Events",
        sponsorLogoUrl: env("SEED_SPONSOR_LOGO_URL", ""),
      },
    },
    create: {
      name: ORG_NAME,
      email: ORG_EMAIL,
      apiKey: ORG_API_KEY,
      status: "active",
      brand: {
        emailFromName: ORG_NAME,
        primary: "#111827",
        secondary: "#9aa3af",
        button: "#2e5fff",
        headerBlue: "#1D4ED8",
        cta: "#B7E000",
        logoUrl:
          "https://dummyimage.com/200x64/111827/ffffff&text=Demo+Events",
        sponsorLogoUrl: env("SEED_SPONSOR_LOGO_URL", ""),
      },
    },
    select: { id: true, name: true, email: true, apiKey: true },
  });

  // -------------------------
  // 2) Organizer admin user
  // -------------------------
  const ADMIN_EMAIL = env("SEED_ADMIN_EMAIL", "admin@demo-events.test");
  const ADMIN_PASS = env("SEED_ADMIN_PASS", "ChangeMeNow123!");
  const ADMIN_ROLE = env("SEED_ADMIN_ROLE", "admin"); // admin|editor|scanner

  const passwordHash = await hashPassword(ADMIN_PASS);

  const adminUser = await prisma.organizerUser.upsert({
    where: { organizerId_email: { organizerId: organizer.id, email: ADMIN_EMAIL } },
    update: { role: ADMIN_ROLE, isActive: true, passwordHash },
    create: {
      organizerId: organizer.id,
      email: ADMIN_EMAIL,
      name: env("SEED_ADMIN_NAME", "Organizer Admin"),
      role: ADMIN_ROLE,
      isActive: true,
      passwordHash,
    },
    select: { email: true, role: true, isActive: true },
  });

  // -------------------------
  // 3) Templates (scoped to organizer)
  // -------------------------
  const templates = await Promise.all([
    prisma.eventTemplate.upsert({
      where: {
        eventtemplate_org_name: {
          organizerId: organizer.id,
          name: "Trade Expo (Free)",
        },
      },
      update: {},
      create: {
        organizerId: organizer.id,
        name: "Trade Expo (Free)",
        description: "Large trade exhibition with free registration.",
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
              "Food & Beverages",
              "Non-Food",
              "Brand Development & Services",
            ],
            coLocatedInterest: true,
            terms: true,
            marketingOptIn: true,
            ageConfirm21: true,
          },
          badgeCategory: "VISITOR",
        },
      },
    }),
    prisma.eventTemplate.upsert({
      where: {
        eventtemplate_org_name: {
          organizerId: organizer.id,
          name: "Conference (Paid)",
        },
      },
      update: {},
      create: {
        organizerId: organizer.id,
        name: "Conference (Paid)",
        description: "Paid conference (payment flow depends on Stripe config).",
        defaults: {
          priceCents: 19900,
          currency: "USD",
          badgeCategory: "DELEGATE",
        },
      },
    }),
    prisma.eventTemplate.upsert({
      where: {
        eventtemplate_org_name: {
          organizerId: organizer.id,
          name: "Workshop (RSVP)",
        },
      },
      update: {},
      create: {
        organizerId: organizer.id,
        name: "Workshop (RSVP)",
        description: "Limited seats, RSVP-only workshop.",
        defaults: {
          capacity: 60,
          badgeCategory: "ATTENDEE",
        },
      },
    }),
  ]);

  // -------------------------
  // 4) Sample event
  // -------------------------
  const EVENT_SLUG = env("SEED_EVENT_SLUG", "prime-expo-2025");
  const event = await prisma.event.upsert({
    where: { slug: EVENT_SLUG },
    update: { organizerId: organizer.id },
    create: {
      slug: EVENT_SLUG,
      title: env("SEED_EVENT_TITLE", "PRIME EXPO 2025"),
      description: env(
        "SEED_EVENT_DESC",
        "The region’s largest private label trade show. Free for trade professionals."
      ),
      date: utc(env("SEED_EVENT_DATE", "2026-02-18T10:00:00Z")),
      venue: env("SEED_EVENT_VENUE", "Dubai World Trade Centre, Halls 4–6"),
      price: parseInt(env("SEED_EVENT_PRICE", "0"), 10) || 0,
      currency: env("SEED_EVENT_CCY", "USD") || "USD",
      capacity: parseInt(env("SEED_EVENT_CAP", "50000"), 10) || 50000,
      organizerId: organizer.id,
    },
    select: { id: true, slug: true, title: true, organizerId: true },
  });

  // -------------------------
  // 5) Optional station
  // -------------------------
  const CREATE_STATION = env("SEED_CREATE_STATION", "1") === "1";
  let station = null;

  if (CREATE_STATION) {
    const STATION_NAME = env("SEED_STATION_NAME", "VIP Entrance");
    const STATION_CODE = env("SEED_STATION_CODE", "VIP");
    const STATION_SECRET = env("SEED_STATION_SECRET", "VipDoor123!");

    const secretHash = await hashPassword(STATION_SECRET);

    station = await prisma.station.upsert({
      where: { station_event_code: { eventId: event.id, code: STATION_CODE } },
      update: { name: STATION_NAME, active: true, secretHash },
      create: {
        eventId: event.id,
        name: STATION_NAME,
        code: STATION_CODE,
        secretHash,
        active: true,
      },
      select: { id: true, name: true, code: true, active: true },
    });

    console.log("[seed] Station secret (store safely):", STATION_SECRET);
  }

  console.log("✅ Seed complete.");
  console.table({
    Organizer: organizer.email,
    ORG_API_KEY: organizer.apiKey,
    AdminEmail: adminUser.email,
    AdminRole: adminUser.role,
    Event: event.slug,
    Templates: templates.length,
    Station: station ? `${station.name} (${station.code})` : "(none)",
  });

  console.log("\nLogin:");
  console.log("  Email:", ADMIN_EMAIL);
  console.log("  Pass :", ADMIN_PASS);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
