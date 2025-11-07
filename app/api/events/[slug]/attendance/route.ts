// app/api/events/[slug]/attendance/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { rateLimit, ipKey } from '@/lib/rateLimit';
import { isLikelyJwt, verifyTicket } from '@/lib/tokens';
import { verifySession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------- helpers ----------
function normalizeMeta(val: unknown): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, any>;
  return {};
}

async function fireWebhook(event: 'attendance.marked', payload: any) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/trigger`;
  const adminKey = (process.env.ADMIN_KEY || '').trim();
  if (!url || !adminKey) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': adminKey },
      body: JSON.stringify({ event, payload }),
      cache: 'no-store',
    });
  } catch {}
}

function readProvidedKey(req: Request) {
  const h = new Headers(req.headers);
  const headerKey = (h.get('x-api-key') ?? '').trim();
  const auth = h.get('authorization') ?? '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return (headerKey || bearer).trim();
}

type GateOk =
  | { ok: true; role: 'admin'; eventId: string }
  | { ok: true; role: 'station'; eventId: string; station: { id: string; name: string } };

// Gate: station cookie (preferred) → admin keys fallback
async function gate(req: Request, slug: string): Promise<GateOk | { ok: false; status: number; error: string }> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, organizer: { select: { apiKey: true } } },
  });
  if (!event) return { ok: false, status: 404, error: 'Event not found' };

  // 1) Station cookie (FIXED name: scan_sess)
  const cookieToken = cookies().get('scan_sess')?.value || cookies().get('sc_sess')?.value || null;
  const sess = verifySession(cookieToken || undefined);
  if (sess && sess.eventId === event.id) {
    const station = await prisma.station.findUnique({
      where: { id: sess.stationId },
      select: { id: true, name: true },
    });
    if (station) return { ok: true, role: 'station', eventId: event.id, station };
  }

  // 2) Admin fallbacks (organizer key / ADMIN_KEY / SCANNER_KEY)
  const provided = readProvidedKey(req);
  const adminKey = (process.env.NEXT_PUBLIC_ADMIN_KEY || process.env.ADMIN_KEY || '').trim();
  const organizerKey = (event.organizer?.apiKey || '').trim();
  const legacyScannerKey = (process.env.SCANNER_KEY || '').trim();

  if (provided && (provided === adminKey || provided === organizerKey || provided === legacyScannerKey)) {
    return { ok: true, role: 'admin', eventId: event.id };
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}

// ---------- GET (stats) — ADMIN ONLY ----------
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const rl = rateLimit({ key: ipKey(req, 'attendance:get'), limit: 120, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const g = await gate(req, params.slug);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
    if (g.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [total, attended, regs] = await Promise.all([
      prisma.registration.count({ where: { eventId: g.eventId } }),
      prisma.registration.count({ where: { eventId: g.eventId, attended: true } }),
      prisma.registration.findMany({
        where: { eventId: g.eventId, attended: true },
        select: { meta: true, scannedBy: true },
      }),
    ]);

    const perScanner: Record<string, number> = {};
    for (const r of regs) {
      const m = normalizeMeta(r.meta);
      const who =
        (r.scannedBy && r.scannedBy.trim()) ||
        (typeof m.scannedBy === 'string' && m.scannedBy.trim()) ||
        'unknown';
      perScanner[who] = (perScanner[who] ?? 0) + 1;
    }

    return NextResponse.json({ ok: true, total, attended, noShows: Math.max(0, total - attended), perScanner });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------- POST (check-in) — STATION or ADMIN ----------
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const rl = rateLimit({ key: ipKey(req, 'scan'), limit: 60, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

    const g = await gate(req, params.slug);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

    const { token, attended = true, scannerId, station } = (await req.json().catch(() => ({}))) as {
      token?: string;
      attended?: boolean;
      scannerId?: string;
      station?: string;
    };
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    // Resolve token
    let reg: { id: string; email: string; meta: unknown; eventId: string } | null = null;

    if (isLikelyJwt(token)) {
      const p = verifyTicket(token);
      if ((p as any)?.sub) {
        const byId = await prisma.registration.findUnique({
          where: { id: (p as any).sub },
          select: { id: true, email: true, meta: true, eventId: true },
        });
        if (byId) {
          if (byId.eventId !== g.eventId) {
            return NextResponse.json({ error: 'Ticket does not belong to this event' }, { status: 404 });
          }
          reg = byId;
        }
      }
    }
    if (!reg) {
      reg = await prisma.registration.findFirst({
        where: { eventId: g.eventId, qrToken: token },
        select: { id: true, email: true, meta: true, eventId: true },
      });
    }
    if (!reg) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    // Duplicate-guard (5s)
    if (attended !== false) {
      const prev = await prisma.registration.findUnique({
        where: { id: reg.id },
        select: { attended: true, scannedAt: true },
      });
      if (prev?.attended && prev.scannedAt) {
        const last = new Date(prev.scannedAt).getTime();
        const now = Date.now();
        if (last && now - last < 5000) {
          return NextResponse.json({
            ok: true,
            duplicate: true,
            message: `Already checked in ${Math.round((now - last) / 100) / 10}s ago`,
          });
        }
      }
    }

    // Server-authoritative scanner name
    const who = g.role === 'station'
      ? g.station.name
      : (station || scannerId || 'unknown').trim();

    const meta0 = normalizeMeta(reg.meta);
    const log = Array.isArray(meta0.scanLog) ? meta0.scanLog : [];
    const nextMeta = {
      ...meta0,
      scannedBy: who || meta0.scannedBy || null,
      scanLog: [...log, { at: new Date().toISOString(), by: who, via: g.role }],
    };

    const updated = await prisma.registration.update({
      where: { id: reg.id },
      data: {
        attended,
        scannedAt: attended ? new Date() : null,
        scannedBy: attended ? who : null,
        meta: nextMeta,
      },
      select: { id: true, email: true, attended: true, scannedAt: true, meta: true, scannedBy: true, eventId: true, qrToken: true },
    });

    // NEW: immutable audit row
    await prisma.attendanceEvent.create({
      data: {
        eventId: updated.eventId,
        registrationId: updated.id,
        qrToken: token,
        action: attended ? 'IN' : 'DENY',
        stationLabel: who || null,
        scannedByUser: g.role === 'admin' ? 'admin' : null,
      },
    });

    fireWebhook('attendance.marked', {
      eventSlug: params.slug,
      eventId: g.eventId,
      registrationId: updated.id,
      email: updated.email,
      attended: updated.attended,
      scannedAt: updated.scannedAt,
      scannerId: updated.scannedBy || 'unknown',
    }).catch(() => {});

    return NextResponse.json({ ok: true, registration: updated });
  } catch (e) {
    console.error('Attendance error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------- PATCH (toggle) — ADMIN ONLY ----------
export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const { registrationId, attended, station } = body as { registrationId?: string; attended?: boolean; station?: string };
    if (!registrationId || typeof attended !== 'boolean') {
      return NextResponse.json({ error: 'registrationId and attended required' }, { status: 400 });
    }

    const g = await gate(req, params.slug);
    if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
    if (g.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, eventId: true, meta: true, qrToken: true },
    });
    if (!reg || reg.eventId !== g.eventId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const meta0 = normalizeMeta(reg.meta);
    const who = (station || meta0.scannedBy || 'admin').trim();
    const log = Array.isArray(meta0.scanLog) ? meta0.scanLog : [];
    const data: any = {
      attended,
      scannedAt: attended ? new Date() : null,
      scannedBy: attended ? who : null,
      meta: attended
        ? { ...meta0, scannedBy: who, scanLog: [...log, { at: new Date().toISOString(), by: who, via: 'admin' }] }
        : meta0,
    };

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data,
      select: { id: true, attended: true, scannedAt: true, scannedBy: true, eventId: true },
    });

    // audit row for admin patch
    await prisma.attendanceEvent.create({
      data: {
        eventId: updated.eventId,
        registrationId: updated.id,
        qrToken: reg.qrToken,
        action: attended ? 'IN' : 'DENY',
        stationLabel: who || null,
        scannedByUser: 'admin',
      },
    });

    return NextResponse.json({ ok: true, registration: updated });
  } catch (e) {
    console.error('Attendance PATCH error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
