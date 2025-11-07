/* app/api/ticket/png/route.ts */
/* app/api/ticket/png/route.tsx
 * CR80 badge generator with @vercel/og (Edge).
 * - Front: small QR (fetched from local /api/qr) + name/title/company + top-left role chip
 * - Back : centered sponsor logo (no QR)
 * - Explicit display on containers to satisfy @vercel/og
 */

import { ImageResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CR80_RATIO = 86 / 54;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ALLOW = new Set(['ATTENDEE', 'VIP', 'SPEAKER', 'STAFF', 'MEDIA', 'EXHIBITOR', 'SPONSOR']);

function q(obj: URLSearchParams, key: string, def = '') {
  const v = (obj.get(key) || '').trim();
  return v || def;
}
function num(obj: URLSearchParams, key: string, def: number) {
  const v = Number(obj.get(key));
  return Number.isFinite(v) ? v : def;
}
function normalizeRole(r?: string) {
  const up = (r || '').trim().toUpperCase();
  return ALLOW.has(up) ? up : 'ATTENDEE';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams;
  const origin = url.origin;

  const token   = q(qs, 'token');
  const variant = q(qs, 'variant', 'front').toLowerCase() === 'back' ? 'back' : 'front';
  const width   = clamp(num(qs, 'width', 1200), 600, 2400);
  const dpi     = clamp(num(qs, 'dpi', 300), 72, 600);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const height = Math.round(width / CR80_RATIO);

  const name       = q(qs, 'name').slice(0, 80);
  const title      = q(qs, 'title').slice(0, 80);
  const company    = q(qs, 'company').slice(0, 80);
  const label      = normalizeRole(q(qs, 'label', 'ATTENDEE'));
  const eventTitle = q(qs, 'eventTitle').slice(0, 120);
  const eventTime  = q(qs, 'eventTime').slice(0, 120);

  // Layout scale
  const pad      = Math.round(width * 0.045);
  const qrSize   = Math.round(width * (variant === 'front' ? 0.22 : 0.55));
  const gap      = Math.round(width * 0.025);
  const radius   = Math.round(width * 0.03);
  const fontLg   = Math.round(width * 0.065);
  const fontMd   = Math.round(width * 0.038);
  const fontSm   = Math.round(width * 0.030);
  const fontXs   = Math.round(width * 0.024);

  // --- Assets we might need ---
  let qrAB: ArrayBuffer | null = null;
  if (variant === 'front') {
    try {
      const qrUrl = `${origin}/api/qr?data=${encodeURIComponent(token)}&size=${Math.round(qrSize * 0.92)}&margin=0`;
      const res = await fetch(qrUrl, { cache: 'no-store', headers: { accept: 'image/png' } });
      if (res.ok) qrAB = await res.arrayBuffer();
    } catch {}
  }

  let sponsorAB: ArrayBuffer | null = null;
  if (variant === 'back') {
    try {
      const res = await fetch(`${origin}/brands/sponsor.png`, { cache: 'force-cache' });
      if (res.ok) sponsorAB = await res.arrayBuffer();
    } catch {}
  }

  // Header role chip (keep only here; removed mid-body duplicate)
  const HeaderChip = (
    <div
      style={{
        display: 'flex',
        fontWeight: 800,
        fontSize: fontXs,
        color: '#0b0d10',
        background: 'linear-gradient(135deg,#FFE58A 0%,#D4AF37 45%,#8B6B16 100%)',
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,.5)',
        textShadow: '0 1px 0 rgba(0,0,0,.4)',
        boxShadow: '0 10px 26px rgba(212,175,55,.55)',
      }}
    >
      {label}
    </div>
  );

  const BodyFront = (
    <div style={{ display: 'flex', flexDirection: 'row', gap, alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      {/* LEFT TEXT (no middle role chip anymore) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(gap * 0.6), flex: 1 }}>
        {name    ? <div style={{ display: 'block', fontSize: fontLg, fontWeight: 800, lineHeight: 1.0, color: '#fff' }}>{name}</div> : null}
        {title   ? <div style={{ display: 'block', fontSize: fontMd, fontWeight: 600, color: '#d1d5db' }}>{title}</div> : null}
        {company ? (
          <div style={{ display: 'block', fontSize: fontSm, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#e5e7eb' }}>
            {company}
          </div>
        ) : null}
      </div>

      {/* RIGHT QR */}
      <div
        style={{
          display: 'flex',
          width: qrSize,
          height: qrSize,
          background: '#fff',
          borderRadius: Math.round(radius * 0.6),
          border: '1px solid rgba(0,0,0,.35)',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 14px 28px rgba(0,0,0,.65)',
          flexShrink: 0,
        }}
      >
        {qrAB ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrAB as any}
            width={Math.round(qrSize * 0.92)}
            height={Math.round(qrSize * 0.92)}
            alt="QR"
            style={{ display: 'block', borderRadius: 6 }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: Math.round(qrSize * 0.9),
              height: Math.round(qrSize * 0.9),
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              color: '#111',
              borderRadius: 6,
              fontSize: fontXs,
              fontWeight: 700,
            }}
          >
            QR UNAVAILABLE
          </div>
        )}
      </div>
    </div>
  );

  const BodyBack = (
    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* Centered sponsor logo */}
      {sponsorAB ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsorAB as any}
          alt="Sponsor"
          width={Math.round(width * 0.45)}
          height={Math.round(height * 0.45)}
          style={{ display: 'block', borderRadius: Math.round(radius * 0.5) }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            padding: 12,
            color: '#cbd5e1',
            fontSize: fontSm,
            background: 'rgba(0,0,0,.35)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.15)',
          }}
        >
          Missing /brands/sponsor.png
        </div>
      )}
    </div>
  );

  const card = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width,
        height,
        padding: pad,
        backgroundColor: '#0f141a',
        backgroundImage:
          'radial-gradient(circle at 20% 0%,rgba(212,175,55,.25) 0%,rgba(0,0,0,0) 60%),' +
          'radial-gradient(circle at 80% 120%,rgba(212,175,55,.10) 0%,rgba(0,0,0,0) 70%)',
        borderRadius: radius,
        border: '2px solid rgba(212,175,55,.35)',
        color: '#fff',
        boxShadow: '0 40px 120px rgba(0,0,0,.9), 0 0 160px rgba(212,175,55,.2) inset',
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: gap,
          paddingBottom: Math.round(gap * 0.6),
          borderBottom: '1px solid rgba(212,175,55,.25)',
        }}
      >
        {HeaderChip}
        <div style={{ display: 'flex', fontSize: fontXs, color: '#cbd5e1' }}>{dpi} DPI • CR80 86×54mm</div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>{variant === 'front' ? BodyFront : BodyBack}</div>

      {/* Footer (front only) */}
      {variant === 'front' && (eventTitle || eventTime) ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: gap,
            paddingTop: Math.round(gap * 0.6),
            borderTop: '1px solid rgba(212,175,55,.2)',
            color: '#e5e7eb',
            fontSize: fontXs,
          }}
        >
          <div style={{ display: 'block', fontWeight: 700 }}>{eventTitle}</div>
          <div style={{ display: 'block', color: '#cbd5e1' }}>{eventTime}</div>
        </div>
      ) : null}
    </div>
  );

  return new ImageResponse(card, { width, height });
}
