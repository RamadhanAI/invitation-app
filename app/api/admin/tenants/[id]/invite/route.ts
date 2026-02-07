// app/api/admin/tenants/[id]/invite/route.ts
// app/api/admin/tenants/[id]/invite/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { sendTenantInviteEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function appUrl(req: Request) {
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sess = getAdminSession();
  if (!sess || sess.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const tenantId = params.id;

  const org = await prisma.organizer.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, email: true },
  });
  if (!org) return NextResponse.json({ error: 'tenant not found' }, { status: 404 });

  // pick earliest admin; if none, create one using organizer.email
  const admin = await prisma.organizerUser.findFirst({
    where: { organizerId: tenantId, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  const email = (admin?.email || org.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'missing tenant email' }, { status: 400 });

  const token = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const user = admin
    ? await prisma.organizerUser.update({
        where: { id: admin.id },
        data: { inviteTokenHash: tokenHash, inviteExpiresAt: expiresAt, isActive: true },
        select: { email: true },
      })
    : await prisma.organizerUser.create({
        data: {
          organizerId: tenantId,
          email,
          name: org.name || null,
          role: 'admin',
          isActive: true,
          inviteTokenHash: tokenHash,
          inviteExpiresAt: expiresAt,
        },
        select: { email: true },
      });

  const base = appUrl(req);
  const inviteUrl = base ? `${base}/invite/${encodeURIComponent(token)}` : '';

  if (inviteUrl) {
    await sendTenantInviteEmail({
      to: user.email,
      inviteUrl,
      organizerName: org.name || 'Your organization',
    }).catch(() => {});
  }

  const url = new URL(req.url);
  const redirectBack = url.searchParams.get('redirect') === '1';

  if (redirectBack) {
    return NextResponse.redirect(new URL('/admin/tenants?invite=sent', req.url), { status: 303 });
  }

  // For non-redirect programmatic usage (dev convenience)
  return NextResponse.json({
    ok: true,
    sent: !!inviteUrl,
    ...(process.env.NODE_ENV !== 'production' ? { inviteUrl } : {}),
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
