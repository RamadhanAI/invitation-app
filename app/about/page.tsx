// app/about/page.tsx
// app/about/page.tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'About – AurumPass',
  description:
    'Luxury event ticketing: premium registrations, cinematic QR badges, and red-carpet check-ins built for modern events.',
};

export default function AboutPage() {
  return (
    <div className="py-10 space-y-10 container-page">
      {/* HERO (match homepage: gradient + split panel) */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/35 shadow-2xl backdrop-blur card">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-fuchsia-600/10 to-indigo-500/10" />
        <GlowBG />

        <div className="relative z-10 grid gap-6 p-6 md:grid-cols-2 md:p-10">
          {/* Left */}
          <div className="flex flex-col justify-center">
            <div className="text-sm text-white/70">About AurumPass</div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl leading-[1.06]">
              Luxury ticketing that feels like a{' '}
              <span className="text-amber-300">VIP entrance</span> — not a queue.
            </h1>

            <p className="mt-4 max-w-[70ch] text-white/75">
              AurumPass helps you host premium events with confidence: beautiful registration, a badge guests actually
              want to keep, and fast check-in that stays calm even when the room is full.
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              <Chip>Branded registration</Chip>
              <Chip>Cinematic QR badges</Chip>
              <Chip>Fast check-in</Chip>
              <Chip>Clear attendance</Chip>
              <Chip>Exports</Chip>
              <Chip>Team-ready</Chip>
            </div>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/request-demo" className="a-btn a-btn--primary a-btn--hero">
                Request a demo
              </Link>
              <Link href="/" className="a-btn a-btn--ghost a-btn--hero">
                See the experience
              </Link>
            </div>

            <div className="mt-3 text-xs text-white/50">
              Built for modern venues, brand-led events, and teams who care about first impressions.
            </div>
          </div>

          {/* Right: “mock screenshots” */}
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 shadow-xl md:p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white/90">How it works</div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/70">
                Quick setup
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <Step
                n="01"
                title="Create your event"
                desc="Add the essentials — name, venue, date — plus the details you want to collect."
              />
              <Step
                n="02"
                title="Share the link"
                desc="Guests register smoothly and receive their pass instantly."
              />
              <Step
                n="03"
                title="Welcome them at the door"
                desc="Scan fast, stay accurate, and keep the line moving."
              />
            </div>

            <div className="grid gap-3 mt-4 sm:grid-cols-2">
              <MockBadgeTile />
              <MockDoorTile />
            </div>

            <div className="mt-5 text-xs text-white/60">
              The result: less stress for staff, a premium feel for guests, and clean records after the event.
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY & PRIVACY (plain English) */}
      <section className="rounded-[22px] border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center border h-11 w-11 rounded-xl border-white/10 bg-black/20 text-white/80">
            <IconLock />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Privacy by design</h2>
            <p className="mt-1 text-sm text-white/70 max-w-[90ch]">
              Your guest list is not marketing content. AurumPass is built so public pages stay clean, while sensitive
              information remains protected behind sign-in.
            </p>
          </div>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-2">
          <SecurityCard
            title="Public pages"
            icon={<IconGlobe />}
            items={[
              'Clean marketing pages — no guest lists, no admin tools.',
              'Event pages show only what you choose to display.',
              'No private attendee details are exposed.',
            ]}
          />
          <SecurityCard
            title="Organizer dashboard"
            icon={<IconPeople />}
            items={[
              'Your team manages only your events and settings.',
              'Exports and attendance stay protected behind sign-in.',
              'Simple controls that keep operations tidy.',
            ]}
          />
          <SecurityCard
            title="Platform admin"
            icon={<IconShield />}
            items={[
              'Approvals and account controls when needed.',
              'Operational tools for trusted administrators only.',
              'Fast response when access must be paused.',
            ]}
          />
          <SecurityCard
            title="Gate staff"
            icon={<IconScan />}
            items={[
              'Scanner access is purpose-built: scan, confirm, and move.',
              'Clear IN/OUT logs for accurate attendance.',
              'Designed for speed under pressure.',
            ]}
          />
        </div>

        <div className="p-4 mt-5 border rounded-2xl border-white/10 bg-black/20">
          <div className="text-sm font-semibold text-white/90">Best-practice checklist</div>
          <ul className="mt-2 space-y-1 text-sm text-white/75">
            <li>• Keep marketing pages clean — let the product do the impressing.</li>
            <li>• Share exports only with trusted team members.</li>
            <li>• Treat scanning access like a door key: give it, use it, rotate it.</li>
          </ul>
        </div>
      </section>

      {/* 3 luxe tiles */}
      <section className="grid gap-4 md:grid-cols-3">
        <InfoTile title="Instant passes" desc="Beautiful registration that issues QR passes immediately." icon={<IconBolt />} />
        <InfoTile title="Fast check-in" desc="Scan confidently — built for real-world door flow." icon={<IconScan />} />
        <InfoTile title="Clean records" desc="Accurate attendance logs and exports after the event." icon={<IconExport />} />
      </section>

      {/* “Hollywood” values */}
      <section className="grid gap-6 md:grid-cols-2">
        <FeatureCard
          title="Designed for first impressions"
          icon={<IconStar />}
          points={[
            'Premium look and feel from registration to entry.',
            'Badges that look good and scan fast.',
            'A guest experience that feels intentional.',
          ]}
        />
        <FeatureCard
          title="Built for smooth operations"
          icon={<IconOps />}
          points={[
            'Simple setup, fast execution, less stress.',
            'Accurate attendance and clear records.',
            'A control panel that feels like a command center.',
          ]}
        />
      </section>

      {/* Credits (one gentle CTA) */}
      <section className="rounded-[22px] border border-white/10 bg-white/5 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-white">Crafted by</h2>
        <p className="mt-3 max-w-[80ch] text-sm text-white/80">
          Top Prestige Technologies LLC — building premium experiences where the entrance sets the tone.
        </p>

        <div className="flex flex-wrap gap-3 mt-5">
          <Link href="/request-demo" className="a-btn a-btn--primary">
            Request a demo
          </Link>
          <Link href="/" className="a-btn a-btn--ghost">
            Back to Home
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ---------- UI Bits ---------- */

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/70">
      {children}
    </span>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-[2px] flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xs font-semibold text-white/80">
          {n}
        </div>
        <div>
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-xs text-white/65">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, desc, icon }: { title: string; desc: string; icon: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center border h-9 w-9 rounded-xl border-white/10 bg-black/20 text-white/80">
          {icon}
        </div>
        <div className="text-base font-semibold text-white/90">{title}</div>
      </div>
      <div className="mt-2 text-sm text-white/65">{desc}</div>
    </div>
  );
}

function FeatureCard({ title, points, icon }: { title: string; points: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/25 p-6 shadow-xl backdrop-blur banana-sheen-hover">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center border h-11 w-11 rounded-xl border-white/10 bg-white/5 text-white/80">
          {icon}
        </div>
        <h3 className="text-base font-semibold text-white/90">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-white/75">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-[2px] text-white/60">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SecurityCard({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center border h-9 w-9 rounded-xl border-white/10 bg-white/5 text-white/80">
          {icon}
        </div>
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>
      <ul className="mt-3 space-y-2 text-sm text-white/75">
        {items.map((x) => (
          <li key={x} className="flex gap-2">
            <span className="mt-[2px] text-white/60">•</span>
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Mock “screenshots” ---------- */

function MockBadgeTile() {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Pass</div>
        <div className="text-white/70">
          <IconBadge />
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-white/90">Cinematic QR</div>

      <div className="p-3 mt-3 border rounded-xl border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-white/65">VIP PASS</div>
          <span className="text-[11px] text-white/50">Print-ready</span>
        </div>
        <div className="flex gap-3 mt-2">
          <div className="grid w-12 h-12 border rounded-lg border-white/10 bg-black/25 place-items-center">
            <div className="w-8 h-8 border rounded-md border-white/10 bg-white/10" />
          </div>
          <div className="flex-1">
            <div className="w-3/4 h-3 rounded bg-white/10" />
            <div className="w-1/2 h-3 mt-2 rounded bg-white/10" />
            <div className="w-full mt-3 border rounded-lg h-7 border-white/10 bg-black/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockDoorTile() {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">Door</div>
        <div className="text-white/70">
          <IconShield />
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-white/90">Live entry logs</div>

      <div className="p-3 mt-3 space-y-2 border rounded-xl border-white/10 bg-white/5">
        {[
          { side: 'IN', who: 'A. Mensah', at: '10:11 PM', ok: true },
          { side: 'IN', who: 'S. Khan', at: '10:12 PM', ok: true },
          { side: 'DENY', who: 'Duplicate scan', at: '10:12 PM', ok: false },
        ].map((r, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 border rounded-lg border-white/10 bg-black/20">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'text-[11px] rounded-full px-2 py-0.5 border',
                  r.ok
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-400/20 bg-rose-500/10 text-rose-200',
                ].join(' ')}
              >
                {r.side}
              </span>
              <span className="text-[11px] text-white/75">{r.who}</span>
            </div>
            <span className="text-[11px] text-white/50">{r.at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Background Glow ---------- */

function GlowBG() {
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full" viewBox="0 0 1200 600" preserveAspectRatio="none">
      <defs>
        <radialGradient id="ap_g1" cx="20%" cy="10%" r="90%">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="45%" stopColor="white" stopOpacity="0.06" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ap_g2" cx="90%" cy="0%" r="80%">
          <stop offset="0%" stopColor="white" stopOpacity="0.10" />
          <stop offset="60%" stopColor="white" stopOpacity="0.03" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="600" fill="url(#ap_g1)" />
      <rect width="1200" height="600" fill="url(#ap_g2)" />
    </svg>
  );
}

/* ---------- Icons (inline, no deps) ---------- */

function IconBadge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M7 3h10l2 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6l2-3Zm5 3a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm-5 9h10v2H7v-2Zm0-3h10v2H7v-2Z"
      />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M12 2l8 4v6c0 5-3.5 8.5-8 10c-4.5-1.5-8-5-8-10V6l8-4Zm-1 12l6-6l-1.4-1.4L11 10.2L8.4 7.6L7 9l4 5Z"
      />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M13 2L3 14h7l-1 8l12-14h-7l-1-6Z" />
    </svg>
  );
}
function IconScan() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M7 3H5a2 2 0 0 0-2 2v2h2V5h2V3Zm12 0h-2v2h2v2h2V5a2 2 0 0 0-2-2ZM5 17H3v2a2 2 0 0 0 2 2h2v-2H5v-2Zm16 0h-2v2h-2v2h2a2 2 0 0 0 2-2v-2ZM7 11h10v2H7v-2Z"
      />
    </svg>
  );
}
function IconExport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M5 20h14v-2H5v2ZM12 2l4 4h-3v7h-2V6H8l4-4Z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M12 2l2.6 6.9L22 9.6l-5 4.6L18.4 22L12 18.6L5.6 22L7 14.2l-5-4.6l7.4-.7L12 2Z"
      />
    </svg>
  );
}
function IconOps() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path fill="currentColor" d="M3 5h18v2H3V5Zm0 6h12v2H3v-2Zm0 6h18v2H3v-2Z" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M12 1a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5Zm3 8V6a3 3 0 1 0-6 0v3h6Z"
      />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M16 11a4 4 0 1 0-3.9-4A4 4 0 0 0 16 11ZM8 11a4 4 0 1 0-4-4a4 4 0 0 0 4 4Zm8 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4ZM8 13c-.6 0-1.3.1-2.1.2C3.5 13.6 2 14.6 2 17v3h4v-3c0-1.1.7-2.1 2-3c.3-.2.6-.4 1-.6c-.3 0-.7-.1-1-.1Z"
      />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-white/80">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm7.9 9h-3.3a16 16 0 0 0-1.2-6A8.02 8.02 0 0 1 19.9 11ZM12 4c.9 1.3 1.8 3.5 2.2 7H9.8C10.2 7.5 11.1 5.3 12 4ZM4.1 13h3.3a16 16 0 0 0 1.2 6A8.02 8.02 0 0 1 4.1 13Zm3.3-2H4.1A8.02 8.02 0 0 1 8.6 5c-.6 1.4-1 3.2-1.2 6Zm2.4 2h4.4c-.4 3.5-1.3 5.7-2.2 7c-.9-1.3-1.8-3.5-2.2-7Zm6.2 6c.6-1.4 1-3.2 1.2-6h3.3a8.02 8.02 0 0 1-4.5 6Zm1.2-8a16 16 0 0 0-1.2-6A8.02 8.02 0 0 1 19.9 11h-3.3ZM12 20c.9-1.3 1.8-3.5 2.2-7H9.8c.4 3.5 1.3 5.7 2.2 7Z"
      />
    </svg>
  );
}
