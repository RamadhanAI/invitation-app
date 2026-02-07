// app/api/demo-request/route.ts
import { NextResponse } from 'next/server';
import * as crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendTenantInviteEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeEmail(v: any) {
  return String(v ?? '').trim().toLowerCase();
}

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function appUrl(req: Request) {
  // Prefer a configured public URL for emails; fall back to request origin.
  const env = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').trim();
  if (env) return env.replace(/\/$/, '');
  try {
    return new URL(req.url).origin;
  } catch {
    return '';
  }
}

async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const json = await req.json().catch(() => null);
    return (json && typeof json === 'object') ? json : {};
  }
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
    const fd = await req.formData();
    const obj: Record<string, any> = {};
    fd.forEach((v, k) => (obj[k] = v));
    // availability can be passed as JSON string
    if (typeof obj.availability === 'string') {
      try { obj.availability = JSON.parse(obj.availability); } catch {}
    }
    return obj;
  }
  // text/plain fallback
  const text = await req.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return (json && typeof json === 'object') ? json : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = await readBody(req);

  const name = String(body.name ?? '').trim();
  const email = normalizeEmail(body.email);
  const company = String(body.company ?? body.organization ?? '').trim();

  if (!name || !email || !company) {
    return NextResponse.json(
      { error: 'Missing required fields', required: ['name', 'email', 'company'] },
      { status: 400 }
    );
  }

  const role = body.role ? String(body.role).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const timezone = body.timezone ? String(body.timezone).trim() : null;
  const availability = body.availability ?? null;
  const notes = body.notes ? String(body.notes).trim() : null;

  // 1) Always log the request
  const demo = await prisma.demoRequest.create({
    data: {
      name,
      email,
      company,
      role,
      phone,
      timezone,
      availability: (availability && typeof availability === 'object') ? availability : undefined,
      notes,
      status: 'new',
    },
    select: { id: true, createdAt: true },
  });

  // 2) Create (or reuse) a tenant record.
  // Organizer.email is unique; we treat it as the tenant admin contact.
  let organizer = await prisma.organizer.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, status: true },
  });

  if (!organizer) {
    organizer = await prisma.organizer.create({
      data: {
        name: company,
        email,
        apiKey: crypto.randomUUID(),
        status: 'pending',
      },
      select: { id: true, name: true, email: true, status: true },
    });
  }

  // 3) Ensure there is an initial tenant admin user and issue an invite token.
  const existingAdmin = await prisma.organizerUser.findFirst({
    where: { organizerId: organizer.id, role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  const token = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let userId: string;

  if (existingAdmin) {
    userId = existingAdmin.id;
    await prisma.organizerUser.update({
      where: { id: existingAdmin.id },
      data: {
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
        // keep passwordHash as-is; invite is for (re)setting access
      },
    });
  } else {
    const u = await prisma.organizerUser.create({
      data: {
        organizerId: organizer.id,
        email,
        name,
        role: 'admin',
        isActive: true,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
      },
      select: { id: true },
    });
    userId = u.id;
  }

  const base = appUrl(req);
  const inviteUrl = base ? `${base}/invite/${encodeURIComponent(token)}` : '';

  // 4) Email the invite link (no-op if email provider not configured)
  if (inviteUrl) {
    await sendTenantInviteEmail({
      to: email,
      inviteUrl,
      organizerName: organizer.name,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    demoRequestId: demo.id,
    tenant: { id: organizer.id, status: organizer.status },
    invite: {
      sent: !!inviteUrl,
      // For dev convenience only.
      ...(process.env.NODE_ENV !== 'production' ? { inviteUrl } : {}),
    },
    userId,
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}
