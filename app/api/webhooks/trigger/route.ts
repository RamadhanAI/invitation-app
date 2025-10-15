// app/api/webhooks/trigger/route.ts
// app/api/webhooks/trigger/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WebhookCfg = {
  url: string;
  events?: string[];                 // which events to receive
  method?: 'POST' | 'GET';           // default POST
  headers?: Record<string, string>;
};

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 300;

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function hmac(body: string, secret?: string) {
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliver(
  url: string,
  body: string,
  method: 'POST' | 'GET',
  headers: Record<string, string>
) {
  // small timeout guard
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

/** Browsers hitting this URL will GET and see 405 instead of a cryptic crash */
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

/**
 * Body shape:
 * { event: 'attendance.marked' | 'registration.created' | 'registration.updated', payload: any }
 *
 * Security: must be called from the server with header x-internal-key = ADMIN_KEY
 */
export async function POST(req: Request) {
  // 🔐 Internal gate: require server-side call with ADMIN_KEY
  const internalKey = (req.headers.get('x-internal-key') || '').trim();
  const adminKey = (process.env.ADMIN_KEY || '').trim();
  if (!adminKey || internalKey !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  if (!json?.event) return NextResponse.json({ error: 'Missing event' }, { status: 400 });

  // ── Find organizer: prefer the organizer that owns the event in payload, else fall back
  let org: { brand: unknown } | null = null;
  try {
    const payloadEventId = json?.payload?.eventId as string | undefined;
    if (payloadEventId) {
      org = await prisma.organizer.findFirst({
        where: { events: { some: { id: payloadEventId } } },
        select: { brand: true },
      });
    }
    if (!org) {
      // single-tenant / fallback
      org = await prisma.organizer.findFirst({ select: { brand: true } });
    }
  } catch {
    // DB hiccup: keep going with no webhooks
    org = null;
  }

  let webhooks: WebhookCfg[] = [];
  try {
    const brand = org?.brand as any;
    if (brand && typeof brand === 'object' && Array.isArray(brand.webhooks)) {
      webhooks = brand.webhooks as WebhookCfg[];
    }
  } catch {
    webhooks = [];
  }

  if (!webhooks.length) {
    return NextResponse.json({ ok: true, delivered: 0, attempted: 0, results: [] });
  }

  // Minimal, safe payload
  const payload = {
    event: String(json.event),
    ts: Date.now(),
    payload: json.payload ?? {},
  };

  const body = JSON.stringify(payload);
  const signingSecret = (process.env.WEBHOOK_SIGNING_SECRET || '').trim();
  const signature = hmac(body, signingSecret);

  const results: Array<{ url: string; ok: boolean; status: number; attempts: number }> = [];

  for (const hook of webhooks) {
    if (!hook?.url) continue;
    const wants = hook.events?.length ? hook.events.includes(json.event) : true;
    if (!wants) continue;

    const method: 'POST' | 'GET' = hook.method || 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}),
      ...(hook.headers || {}),
    };

    let attempt = 0;
    let last = { ok: false, status: 0 };
    while (attempt < MAX_RETRIES) {
      last = await deliver(hook.url, body, method, headers);
      if (last.ok) break;
      attempt++;
      await sleep(RETRY_BASE_MS * Math.pow(2, attempt - 1));
    }
    results.push({ url: hook.url, ok: last.ok, status: last.status, attempts: attempt + 1 });
  }

  const delivered = results.filter(r => r.ok).length;
  return NextResponse.json({ ok: true, delivered, attempted: results.length, results });
}
