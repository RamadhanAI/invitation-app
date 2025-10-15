// lib/brand.ts
// lib/brand.ts
import { prisma } from '@/lib/db';

export type Brand = {
  primary?: string;
  secondary?: string;
  button?: string;
  logoUrl?: string;
  emailFromName?: string;
  [k: string]: unknown;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function toBrand(val: unknown): Brand {
  // if the value is a JSON string, parse it
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (isPlainObject(parsed)) return parsed as Brand;
    } catch {
      // ignore parse errors; fall through to {}
    }
  }
  // if it’s already a JSON object (Prisma Json field), return it
  if (isPlainObject(val)) return val as Brand;

  // default empty brand
  return {};
}

export async function loadBrand(): Promise<Brand> {
  // MVP: just get the first organizer’s brand
  const org = await prisma.organizer.findFirst({ select: { brand: true } });
  return toBrand(org?.brand);
}
