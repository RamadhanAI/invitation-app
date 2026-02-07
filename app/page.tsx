// app/page.tsx
// app/page.tsx
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

function Feature({
  title,
  desc,
  icon,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-5 card md:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          {icon}
        </div>
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm leading-relaxed text-white/70">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
}: {
  n: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-5 card">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
          <span className="text-sm font-semibold text-white/80">{n}</span>
        </div>
        <div>
          <div className="font-semibold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/70">{desc}</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="py-10 container-page md:py-14">
      {/* Inline CSS (safe) for subtle animations. No extra deps. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes floaty { 0%,100%{ transform: translateY(0)} 50%{ transform: translateY(-10px)} }
            @keyframes shimmer { 0%{ transform: translateX(-120%) skewX(-10deg); opacity:0 } 12%{opacity:.45} 55%{opacity:.25} 100%{ transform: translateX(120%) skewX(-10deg); opacity:0 } }
            @keyframes popin { from{ opacity:0; transform: translateY(10px) scale(.98)} to{ opacity:1; transform: translateY(0) scale(1)} }

            .hero-wrap{ position:relative; overflow:hidden; border-radius: 1.5rem; }
            .hero-glow{
              position:absolute; inset:-2px;
              background:
                radial-gradient(900px 600px at 10% 0%, color-mix(in oklab, var(--accent) 26%, transparent), transparent 60%),
                radial-gradient(800px 520px at 90% 10%, color-mix(in oklab, var(--accent-2) 22%, transparent), transparent 62%),
                radial-gradient(1000px 650px at 50% 120%, rgba(183,224,0,.12), transparent 60%);
              pointer-events:none;
              filter: blur(0px);
              opacity:.9;
            }
            .hero-sheen::after{
              content:"";
              position:absolute; inset:0;
              left:-40%;
              width:25%;
              background: linear-gradient(115deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.10) 45%, rgba(255,255,255,.22) 55%, rgba(255,255,255,.10) 65%, rgba(255,255,255,0) 100%);
              mix-blend-mode: soft-light;
              filter: blur(1px);
              animation: shimmer 6.2s linear infinite;
              pointer-events:none;
            }
            .popin{ animation: popin 520ms ease-out both; }
            .floaty{ animation: floaty 6.5s ease-in-out infinite; }
            .floaty2{ animation: floaty 7.8s ease-in-out infinite; animation-delay: .5s; }
            @media (prefers-reduced-motion: reduce){
              .hero-sheen::after,.floaty,.floaty2,.popin{ animation:none !important; }
            }
          `,
        }}
      />

      {/* HERO: split layout */}
      <section className="p-6 hero-wrap glass glass--pop hero-sheen md:p-10">
        <div className="hero-glow" />

        <div className="relative grid gap-10 md:grid-cols-12 md:items-center">
          {/* LEFT: What AurumPass is */}
          <div className="popin md:col-span-7">
            <h1 className="text-white h-hero">
              AurumPass.{' '}
              <span className="text-[color:var(--cta-lime)]">Luxury</span> ticketing & instant check-in.
            </h1>

            <p className="max-w-2xl mt-3 text-white/70">
              Create events, collect registrations, send cinematic QR badges,
              and scan guests at the door — with multi-tenant control for agencies,
              venues, and organizers.
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              <Badge>Multi-tenant</Badge>
              <Badge>QR badges + .ics</Badge>
              <Badge>Scanner IN/OUT</Badge>
              <Badge>Exports</Badge>
              <Badge>Branding</Badge>
            </div>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/request-demo" className="btn btn-primary">
                Request a demo
              </Link>
              <Link href="/admin" className="btn btn-ghost">
                Admin dashboard
              </Link>
              <Link href="/scan" className="btn btn-ghost">
                Scanner
              </Link>
            </div>

            <div className="mt-6 text-xs text-white/55">
              Public homepage shows <span className="text-white/80">zero</span> tenant data. Private stuff stays private.
            </div>
          </div>

          {/* RIGHT: How to use it */}
          <div className="md:col-span-5">
            <div className="p-5 card md:p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">How it works</div>
                <span className="badge">2 mins</span>
              </div>

              <div className="grid gap-3 mt-4">
                <Step
                  n="01"
                  title="Create an event"
                  desc="Set title, venue, date, and your custom registration fields."
                />
                <Step
                  n="02"
                  title="Share the link"
                  desc="Guests register, receive QR badges + calendar invites."
                />
                <Step
                  n="03"
                  title="Scan at the gate"
                  desc="Fast IN/OUT check with a clean audit trail and export."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-4 border rounded-2xl border-white/10 bg-white/5 floaty">
                  <div className="text-xs text-white/60">Badge</div>
                  <div className="mt-1 text-sm font-semibold text-white">Cinematic QR</div>
                  <div className="mt-3 h-14 rounded-xl bg-white/5 ring-1 ring-white/10" />
                </div>
                <div className="p-4 border rounded-2xl border-white/10 bg-white/5 floaty2">
                  <div className="text-xs text-white/60">Door</div>
                  <div className="mt-1 text-sm font-semibold text-white">IN / OUT logs</div>
                  <div className="mt-3 h-14 rounded-xl bg-white/5 ring-1 ring-white/10" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5">
                <Link href="/request-demo" className="a-btn a-btn--primary">
                  Get onboarded
                </Link>
                <Link href="/about" className="a-btn a-btn--strong">
                  Learn more
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-4 mt-8 md:mt-10 md:grid-cols-3">
        <Feature
          title="Instant tickets"
          desc="Registrations generate QR badges + calendar invites automatically."
          icon={<span className="text-white/80">🎟️</span>}
        />
        <Feature
          title="Fast check-in"
          desc="Camera scanning or keyboard wedge. Built for speed under pressure."
          icon={<span className="text-white/80">⚡</span>}
        />
        <Feature
          title="Clean exports"
          desc="CSV attendance exports, with time stamps and station labels."
          icon={<span className="text-white/80">📄</span>}
        />
      </section>

      {/* CTA STRIP */}
      <section className="p-6 mt-10 glass md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-semibold text-white">Run your next event like a movie premiere.</div>
            <div className="mt-1 text-sm text-white/70">
              Onboard your team, brand the experience, and ship a premium check-in flow.
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/request-demo" className="btn btn-primary">
              Request a demo
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Go to admin
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
