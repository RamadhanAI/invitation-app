// app/api/admin/tenants/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['pending', 'active', 'suspended']);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sess = getAdminSession();
  if (!sess || sess.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const status = String(form?.get('status') ?? '').trim();

  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const id = params.id;
  await prisma.organizer.update({ where: { id }, data: { status } });

  // Optionally disable all staff when suspended
  if (status === 'suspended') {
    await prisma.organizerUser.updateMany({ where: { organizerId: id }, data: { isActive: false } });
  }
  if (status === 'active') {
    // don't force-enable everybody; only leave current flags as-is
  }

  return NextResponse.redirect(new URL('/admin/tenants', req.url), { status: 303 });
}
