// app/about/page.tsx
// app/about/page.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'About – Invitation App',
  description:
    'Premium registrations, cinematic QR badges, and red-carpet check-ins engineered for speed and reliability.',
};

export default function AboutPage() {
  return (
    <div className="py-8 space-y-10 container-page">
      {/* HERO */}
      <section className="relative p-6 overflow-hidden md:p-10 rounded-2xl a-card banana-sheen-hover">
        <GlowBG />
        <h1 className="relative z-10 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Invitation App — premium registrations & red-carpet check-ins
        </h1>
        <p className="relative z-10 mt-4 text-white/80 max-w-[72ch]">
          From branded sign-ups to pixel-perfect QR badges and live gate stats.
          Engineered for speed, reliability, and showtime polish.
        </p>
        <div className="relative z-10 flex flex-wrap gap-2 mt-6">
          <Link href="/admin" className="a-btn a-btn--primary">Open Admin</Link>
          <Link href="/scan" className="a-btn a-btn--ghost">Open Scanner</Link>
          <Link href="/e/prime-expo-2025" className="a-btn a-btn--ghost">Sample Event</Link>
        </div>
      </section>

      {/* STATS RIBBON */}
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Check-ins / second" value="Fast" hint="Server-guarded, duplicate-safe" />
        <StatCard label="Badge fidelity" value="300 DPI" hint="Front + back print sheet" />
        <StatCard label="Exports" value="CSV" hint="Clean columns, audit trail" />
      </section>

      {/* FEATURES */}
      <section className="grid gap-6 md:grid-cols-2">
        <FeatureCard
          title="Registration that converts"
          points={[
            'Branded form, email confirm, optional captcha',
            'ICS calendar attachment',
            'Idempotent: (event,email) safe re-submits',
          ]}
          icon={<IconForm />}
        />
        <FeatureCard
          title="Badges that scan perfectly"
          points={[
            'Crisp QR with name/title/company',
            'Unified print page: front + back',
            'PNG endpoints for emails & ops',
          ]}
          icon={<IconBadge />}
        />
        <FeatureCard
          title="Gate you can trust"
          points={[
            'Station cookies or admin key fallback',
            '5s duplicate-scan guard',
            'Immutable attendance events (audit)',
          ]}
          icon={<IconShield />}
        />
        <FeatureCard
          title="Ops and reporting"
          points={[
            'Per-scanner stats & live activity',
            'Mark paid / attended / checkout',
            'CSV import & export at any time',
          ]}
          icon={<IconOps />}
        />
      </section>

      {/* TECH STACK */}
      <section className="p-6 md:p-8 rounded-2xl a-card">
        <h2 className="text-lg font-semibold text-white">Under the hood</h2>
        <ul className="grid gap-2 mt-3 text-sm text-white/80 md:grid-cols-2">
          <li>• Next.js App Router + React 18</li>
          <li>• Prisma + Postgres (Supabase-ready)</li>
          <li>• Optional JWT tickets, legacy token compatible</li>
          <li>• Rate-limits on hot paths, optional captcha</li>
          <li>• Server-authoritative scans with audit rows</li>
          <li>• Clean, composable API routes</li>
        </ul>
      </section>

      {/* CREDITS */}
      <section className="p-6 md:p-8 rounded-2xl a-card a-card--soft">
        <h2 className="text-lg font-semibold text-white">Crafted by</h2>
        <p className="mt-3 text-sm text-white/80 max-w-[80ch]">
          <Link
            href="https://triggerdxb.com"
            target="_blank"
            className="underline underline-offset-4"
            title="Trigger Motion Picture Productions"
          >
            Trigger Motion Picture Productions
          </Link>
          {' '}— engineered for premium experiences where first impressions start at the gate.
        </p>
      </section>
    </div>
  );
}

/* ---------- Server-safe visual building blocks (no event handlers) ---------- */

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="p-4 rounded-2xl a-card a-card--soft">
      <div className="text-xs text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/60">{hint}</div>
    </div>
  );
}

function FeatureCard({
  title,
  points,
  icon,
}: {
  title: string;
  points: string[];
  icon: ReactNode;
}) {
  return (
    <div className="flex gap-4 p-6 rounded-2xl a-card banana-sheen-hover">
      <div className="flex items-center justify-center w-12 h-12 border shrink-0 rounded-xl bg-white/5 border-white/10">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <ul className="mt-2 space-y-1 text-sm text-white/80">
          {points.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GlowBG() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 800 300"
      preserveAspectRatio="none"
    >
      <defs>
        <radialGradient id="g" cx="0%" cy="0%" r="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="40%" stopColor="white" stopOpacity="0.06" />
          <stop offset="100%" stopColor="black" stopOpacity="0.0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="800" height="300" fill="url(#g)" />
    </svg>
  );
}

/* ---------- Minimal inline icons (no deps) ---------- */

function IconForm() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v14l-5-3H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4h8v2H6V7Zm0 4h11v2H6v-2Z" />
    </svg>
  );
}
function IconBadge() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M7 3h10l2 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6l2-3Zm5 3a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm-5 9h10v2H7v-2Zm0-3h10v2H7v-2Z"/>
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M12 2l8 4v6c0 5-3.5 8.5-8 10c-4.5-1.5-8-5-8-10V6l8-4Zm-1 12l6-6l-1.4-1.4L11 10.2L8.4 7.6L7 9l4 5Z"/>
    </svg>
  );
}
function IconOps() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M3 5h18v2H3V5Zm0 6h12v2H3v-2Zm0 6h18v2H3v-2Z"/>
    </svg>
  );
}
