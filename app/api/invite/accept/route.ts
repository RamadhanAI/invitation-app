// app/api/invite/accept/route.ts
// app/api/invite/accept/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({} as any))) as {
    token?: string;
    password?: string;
    name?: string;
  };

  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '').trim();
  const name = body.name ? String(body.name).trim() : '';

  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (name && name.length < 2) {
    return NextResponse.json({ error: 'Name is too short' }, { status: 400 });
  }

  const tokenHash = sha256Hex(token);

  const user = await prisma.organizerUser.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Invite link is invalid or expired' }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);

  await prisma.organizerUser.update({
    where: { id: user.id },
    data: {
      passwordHash,
      isActive: true,
      ...(name ? { name } : {}),
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
