import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, ipKey } from '@/lib/rateLimit';
import { sendRegistrationEmail } from '@/lib/email';
import { signTicket, verifyTicket } from '@/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(req: Request, slug: string) {
  const headerKey = req.headers.get('x-api-key') ?? '';
  const devKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || '';
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, title: true, date: true, price: true, currency: true, venue: true, organizer: { select: { brand: true, apiKey: true } } },
  });
  if (!event) return { ok: false as const, status: 404, error: 'Event not found' };
  const ok = !!headerKey && (headerKey === (event.organizer?.apiKey || '') || (!!devKey && headerKey === devKey));
  return ok ? { ok: true as const, event } : { ok: false as const, status: 401, error: 'Unauthorized' };
}

function toBrand(val: any) { if (typeof val === 'string') try { return JSON.parse(val) } catch {} ; return (val && typeof val === 'object') ? val : {}; }

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  try {
    const rl = rateLimit({ key: ipKey(req, 'import'), limit: 6, windowMs: 60_000 });
    if (!rl.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

    const gate = await requireAdmin(req, params.slug);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const text = await req.text();
    if (!text.trim()) return NextResponse.json({ error: 'Empty CSV' }, { status: 400 });

    // Expected headers (case-insensitive): email, firstName, lastName, jobTitle, companyName, paid?
    const [headerLine, ...lines] = text.split(/\r?\n/).filter(Boolean);
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    const res: { created: number; updated: number; errors: number } = { created: 0, updated: 0, errors: 0 };
    const brand = toBrand(gate.event.organizer?.brand);

    for (const line of lines) {
      const cols = line.split(',');
      const email = (cols[idx('email')] || '').trim().toLowerCase();
      if (!email) { res.errors++; continue; }

      const meta = {
        firstName: (cols[idx('firstname')] || cols[idx('first_name')] || '').trim() || undefined,
        lastName: (cols[idx('lastname')] || cols[idx('last_name')] || '').trim() || undefined,
        jobTitle: (cols[idx('jobtitle')] || cols[idx('job_title')] || '').trim() || undefined,
        companyName: (cols[idx('companyname')] || cols[idx('company_name')] || '').trim() || undefined,
      };
      const paidFlag = ((cols[idx('paid')] || '').trim().toLowerCase()) === 'true';

      // idempotent by (eventId,email)
      let reg = await prisma.registration.findUnique({
        where: { eventId_email: { eventId: gate.event.id, email } },
        select: { id: true, email: true, paid: true, qrToken: true, meta: true },
      });

      if (!reg) {
        reg = await prisma.registration.create({
          data: {
            eventId: gate.event.id,
            email,
            price: gate.event.price,
            paid: paidFlag || gate.event.price === 0,
            qrToken: Math.random().toString(36).slice(2, 12), // will upgrade to JWT below
            meta,
          },
          select: { id: true, email: true, paid: true, qrToken: true, meta: true },
        });
        res.created++;
      } else {
        await prisma.registration.update({
          where: { id: reg.id },
          data: { paid: paidFlag || reg.paid, meta: { ...(typeof reg.meta === 'object' ? reg.meta : {}), ...meta } },
        });
        res.updated++;
      }

      if (process.env.TICKET_JWT_SECRET && reg) {
        const ok = verifyTicket(reg.qrToken);
        if (!ok) {
          const jwt = signTicket({ sub: reg.id, eventId: gate.event.id, email: reg.email });
          await prisma.registration.update({ where: { id: reg.id }, data: { qrToken: jwt } });
          reg.qrToken = jwt;
        }
      }

      // email (fire-and-forget)
      sendRegistrationEmail({
        to: email,
        brand,
        event: { title: gate.event.title, date: gate.event.date ?? undefined, venue: gate.event.venue ?? undefined, currency: gate.event.currency, price: gate.event.price },
        token: reg?.qrToken!,
        meta: { firstName: meta.firstName, lastName: meta.lastName, jobTitle: meta.jobTitle, companyName: meta.companyName },
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error('Import error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
