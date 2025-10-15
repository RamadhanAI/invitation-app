// app/api/templates/route.ts
// app/api/templates/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILTIN = [
  {
    id: 'builtin:tech-conference',
    name: 'Tech Conference',
    description: 'Two-track tech conference with expo area.',
    defaults: {
      title: 'Tech Conference',
      venue: 'Main Hall A',
      capacity: 500,
      price: 0,
      currency: 'USD',
      bannerUrl: '/images/banners/tech.jpg',
      description: 'A full-day event featuring talks, workshops, and networking with tech leaders.',
    },
  },
  {
    id: 'builtin:ai-workshop',
    name: 'AI Workshop',
    description: 'Hands-on training with small-group labs.',
    defaults: {
      title: 'AI Workshop',
      venue: 'Innovation Lab',
      capacity: 80,
      price: 15000,
      currency: 'USD',
      bannerUrl: '/images/banners/ai.jpg',
      description: 'A practical, instructor-led workshop on modern AI tooling and deployment.',
    },
  },
  {
    id: 'builtin:food-expo',
    name: 'Food & Beverage Expo',
    description: 'Trade exhibition with buyer–supplier matchmaking.',
    defaults: {
      title: 'Food & Beverage Expo',
      venue: 'Exhibition Center',
      capacity: 2000,
      price: 0,
      currency: 'AED',
      bannerUrl: '/images/banners/food.jpg',
      description: 'Regional showcase of F&B brands, logistics providers, and packaging solutions.',
    },
  },
  {
    id: 'builtin:fintech-meetup',
    name: 'FinTech Meetup',
    description: 'Evening meetup + panel + networking.',
    defaults: {
      title: 'FinTech Meetup',
      venue: 'City Hub',
      capacity: 150,
      price: 0,
      currency: 'USD',
      bannerUrl: '/images/banners/fintech.jpg',
      description: 'A community evening focused on payments, compliance, and digital banking.',
    },
  },
] as const;

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as any, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET() {
  try {
    const db = await prisma.eventTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, description: true, defaults: true },
    });
    return ok({ templates: [...BUILTIN, ...db] });
  } catch (e: any) {
    // DB unreachable → still return built-ins so the UI doesn't break
    if (e?.code === 'P1001') {
      console.warn('[templates] DB unreachable (P1001). Returning built-ins.');
      return ok({ templates: [...BUILTIN] });
    }
    console.warn('[templates] GET error:', e?.message || e);
    return ok({ templates: [...BUILTIN] });
  }
}

export async function POST(req: Request) {
  const provided = (req.headers.get('x-api-key') || '').trim();
  if (!provided) return ok({ error: 'Unauthorized' }, 401);

  try {
    const adminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();

    // Determine organizerId (admin can create for the first organizer)
    let organizerId: string | null = null;
    if (adminKey && provided === adminKey) {
      const org = await prisma.organizer.findFirst({ select: { id: true } });
      organizerId = org?.id ?? null;
    } else {
      const org = await prisma.organizer.findUnique({
        where: { apiKey: provided },
        select: { id: true },
      });
      if (!org) return ok({ error: 'Unauthorized' }, 401);
      organizerId = org.id;
    }

    const body = await req.json().catch(() => ({}));
    const { name, description = '', defaults } = body || {};
    if (!name || !defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
      return ok({ error: 'Provide name and defaults (object)' }, 400);
    }

    const tpl = await prisma.eventTemplate.create({
      data: {
        name,
        description,
        defaults,
        // @ts-ignore — include if your schema has it, Prisma ignores unknown keys otherwise.
        organizerId,
      },
      select: { id: true, name: true, description: true, defaults: true },
    });

    return ok({ ok: true, template: tpl }, 201);
  } catch (e: any) {
    if (e?.code === 'P1001') {
      return ok({ error: 'Database unreachable (pooler). Try again or use PRISMA_USE_DIRECT=1 for dev.' }, 503);
    }
    console.error('[templates] POST error:', e);
    return ok({ error: 'Internal error' }, 500);
  }
}
