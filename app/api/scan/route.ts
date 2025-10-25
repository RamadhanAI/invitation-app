// app/api/scan/route.ts
// app/api/scan/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTicket } from "@/lib/tokens";
import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OPTIONAL: light per-IP guard (10 requests / 10s)
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function POST(req: Request) {
  try {
    const { token } = (await req.json().catch(() => ({}))) as { token?: string };
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // Optional rate limit by IP
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "anon";
    const rl = await ratelimit.limit(`scan:ip:${ip}`);
    if (!rl.success) return NextResponse.json({ error: "Slow down" }, { status: 429 });

    // --- Idempotency lock (3–6s) ---
    // Use the raw token as the key; it's stable whether it's JWT or legacy.
    const lockKey = `scan:${token}`;
    const gotLock = await redis.set(lockKey, "1", { nx: true, ex: 6 });
    if (!gotLock) {
      // Someone just scanned the same code moments ago → treat as duplicate
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // 1) Prefer JWT verification if secret is configured
    let reg: null | { id: string; attended: boolean; scannedAt: Date | null } = null;
    const payload = process.env.TICKET_JWT_SECRET ? verifyTicket(token) : null;

    if (payload?.sub && payload.eventId) {
      reg = await prisma.registration.findUnique({
        where: { id: payload.sub },
        select: { id: true, attended: true, scannedAt: true },
      });
      // If not found, fall through to legacy lookup below
    }

    // 2) Fallback to legacy raw token match
    if (!reg) {
      reg = await prisma.registration.findUnique({
        where: { qrToken: token },
        select: { id: true, attended: true, scannedAt: true },
      });
    }

    if (!reg) return NextResponse.json({ error: "Invalid or unknown ticket" }, { status: 404 });

    // 3) Idempotent write: only set attended=true if it was false
    const alreadyCheckedIn = !!reg.attended;
    let scannedAt = reg.scannedAt;

    if (!alreadyCheckedIn) {
      const updated = await prisma.registration.update({
        where: { id: reg.id },
        data: { attended: true, scannedAt: new Date() },
        select: { scannedAt: true },
      });
      scannedAt = updated.scannedAt;
    }

    return NextResponse.json({
      ok: true,
      id: reg.id,
      scannedAt,
      alreadyCheckedIn,
    });
  } catch (e) {
    console.error("scan error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
