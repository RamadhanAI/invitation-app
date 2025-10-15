// lib/admin-export.ts
import { prisma } from '@/lib/db';
import crypto from 'crypto';

const ADMIN_COOKIE = 'inv_admin';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me';

/** base64url encode */
function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
/** base64url decode */
function fromB64url(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return Buffer.from(s, 'base64').toString('utf8');
}

/** read a cookie value from Request */
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(/; */)) {
    const [k, ...v] = part.split('=');
    if (k?.trim() === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** verify admin cookie (HMAC over the p64 string — matches our login route) */
function verifyAdminCookie(token: string | null): boolean {
  if (!token) return false;
  const [p64, s64] = token.split('.');
  if (!p64 || !s64) return false;
  const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(p64).digest());
  if (expected !== s64) return false;
  try {
    const payload = JSON.parse(fromB64url(p64));
    const now = Math.floor(Date.now() / 1000);
    return Boolean(payload?.exp && now < payload.exp);
  } catch {
    return false;
  }
}

/** allow API Key via header, bearer, or ?key= */
function extractProvidedKey(req: Request): string {
  const url = new URL(req.url);
  const q = (url.searchParams.get('key') || '').trim();
  const hdr = (req.headers.get('x-api-key') || '').trim();
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  return q || hdr || bearer;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/["\n\r,]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** main handler used by both export routes (singular/plural) */
export async function handleRegistrationsExport(req: Request, slug: string): Promise<Response> {
  // 1) load event + organizer
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { organizer: { select: { apiKey: true, name: true } } },
  });
  if (!event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 2) authorize: admin cookie OR org/admin api key
  const cookieOk = verifyAdminCookie(readCookie(req, ADMIN_COOKIE));
  const providedKey = extractProvidedKey(req);
  const orgKey = (event.organizer?.apiKey || '').trim();
  const envAdminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
  const keyOk = providedKey && (providedKey === orgKey || providedKey === envAdminKey);

  if (!cookieOk && !keyOk) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 3) fetch registrations
  const rows = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: { registeredAt: 'asc' },
    select: {
      id: true,
      email: true,
      price: true,
      paid: true,
      attended: true,
      registeredAt: true,
      scannedAt: true,
      scannedBy: true,
      checkedOutAt: true,
      checkedOutBy: true,
      qrToken: true,
    },
  });

  // 4) to CSV
  const header = [
    'id','email','price','paid','attended',
    'registeredAt','scannedAt','scannedBy',
    'checkedOutAt','checkedOutBy','qrToken'
  ].join(',');

  const body = rows.map((r: { id: any; email: any; price: any; paid: any; attended: any; registeredAt: any; scannedAt: any; scannedBy: any; checkedOutAt: any; checkedOutBy: any; qrToken: any; }) => [
    r.id, r.email, r.price, r.paid, r.attended,
    r.registeredAt, r.scannedAt, r.scannedBy,
    r.checkedOutAt, r.checkedOutBy, r.qrToken
  ].map(csvEscape).join(','));

  const csv = [header, ...body].join('\n');
  const filename = `registrations-${slug}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
