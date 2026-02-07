/* app/api/ticket/png/route.ts */
/* app/api/ticket/png/route.ts */
import { ImageResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CR80_RATIO = 86 / 54;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ALLOW_ROLE = new Set(['ATTENDEE', 'VIP', 'SPEAKER', 'STAFF', 'MEDIA', 'EXHIBITOR', 'SPONSOR']);
const ALLOW_TPL = new Set(['midnight_gold', 'pearl_white', 'obsidian', 'emerald', 'royal_blue', 'sunrise']);
const ALLOW_BG = new Set(['dark', 'light']);

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
  return ALLOW_ROLE.has(up) ? up : 'ATTENDEE';
}
function safeHex(v: string) {
  const s = (v || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '';
}

/**
 * ✅ Accept:
 * - https://... (prod)
 * - http://localhost... (dev)
 * - /relative/path (same-origin)
 *
 * Return absolute URL string or '' if invalid.
 */
function safeAssetUrl(origin: string, maybe: string | null) {
  const v = (maybe || '').trim();
  if (!v) return '';

  // allow same-origin relative
  if (v.startsWith('/')) return `${origin}${v}`;

  try {
    const u = new URL(v);
    if (u.protocol === 'https:') return u.toString();
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return u.toString();
    return '';
  } catch {
    return '';
  }
}

type Theme = {
  bg: string;
  bgImg: string;
  textMain: string;
  textSub: string;
  line: string;
  chipText: string;
  chipBg: string;
  qrShadow: string;
  border: string;
  inset: string;
};

function themeFor(template: string, bgHint: string, accent: string): Theme {
  const ACC = safeHex(accent) || '#D4AF37';
  const isLight = (ALLOW_BG.has(bgHint as any) ? bgHint : '') === 'light';

  const baseDark: Theme = {
    bg: '#0f141a',
    bgImg:
      `radial-gradient(circle at 20% 0%,rgba(212,175,55,.22) 0%,rgba(0,0,0,0) 60%),` +
      `radial-gradient(circle at 80% 120%,rgba(212,175,55,.08) 0%,rgba(0,0,0,0) 70%)`,
    textMain: '#ffffff',
    textSub: '#cbd5e1',
    line: 'rgba(212,175,55,.25)',
    chipText: '#0b0d10',
    chipBg: `linear-gradient(135deg,#FFE58A 0%,${ACC} 45%,#8B6B16 100%)`,
    qrShadow: '0 14px 28px rgba(0,0,0,.65)',
    border: `2px solid rgba(212,175,55,.35)`,
    inset: '0 40px 120px rgba(0,0,0,.9), 0 0 160px rgba(212,175,55,.2) inset',
  };

  const baseLight: Theme = {
    bg: '#f8fafc',
    bgImg:
      `radial-gradient(circle at 20% 0%,rgba(14,165,233,.14) 0%,rgba(255,255,255,0) 60%),` +
      `radial-gradient(circle at 80% 120%,rgba(212,175,55,.12) 0%,rgba(255,255,255,0) 70%)`,
    textMain: '#0b0d10',
    textSub: '#334155',
    line: 'rgba(15,23,42,.12)',
    chipText: '#0b0d10',
    chipBg: `linear-gradient(135deg,#E0F2FE 0%,${ACC} 55%,#FDE68A 100%)`,
    qrShadow: '0 16px 30px rgba(2,6,23,.25)',
    border: `2px solid rgba(2,6,23,.10)`,
    inset: '0 28px 90px rgba(2,6,23,.12), 0 0 120px rgba(14,165,233,.10) inset',
  };

  const pick = isLight ? baseLight : baseDark;

  switch (template) {
    case 'pearl_white':
      return {
        ...baseLight,
        chipBg: `linear-gradient(135deg,#ffffff 0%,${ACC} 55%,#E2E8F0 100%)`,
        bgImg:
          `radial-gradient(circle at 25% 0%,rgba(255,255,255,1) 0%,rgba(255,255,255,0) 55%),` +
          `radial-gradient(circle at 70% 140%,rgba(14,165,233,.10) 0%,rgba(255,255,255,0) 65%)`,
      };
    case 'obsidian':
      return {
        ...baseDark,
        bg: '#0b0d10',
        bgImg:
          `radial-gradient(circle at 20% 0%,rgba(148,163,184,.10) 0%,rgba(0,0,0,0) 60%),` +
          `radial-gradient(circle at 80% 120%,rgba(14,165,233,.08) 0%,rgba(0,0,0,0) 70%)`,
        border: `2px solid rgba(148,163,184,.18)`,
      };
    case 'emerald':
      return {
        ...pick,
        chipBg: `linear-gradient(135deg,#A7F3D0 0%,${ACC} 55%,#064E3B 100%)`,
        bgImg:
          `radial-gradient(circle at 20% 0%,rgba(16,185,129,.16) 0%,rgba(0,0,0,0) 60%),` +
          `radial-gradient(circle at 80% 120%,rgba(212,175,55,.10) 0%,rgba(0,0,0,0) 70%)`,
      };
    case 'royal_blue':
      return {
        ...pick,
        chipBg: `linear-gradient(135deg,#DBEAFE 0%,${ACC} 55%,#1E3A8A 100%)`,
        bgImg:
          `radial-gradient(circle at 22% 0%,rgba(37,99,235,.14) 0%,rgba(0,0,0,0) 60%),` +
          `radial-gradient(circle at 80% 120%,rgba(212,175,55,.10) 0%,rgba(0,0,0,0) 70%)`,
      };
    case 'sunrise':
      return {
        ...pick,
        chipBg: `linear-gradient(135deg,#FFEDD5 0%,${ACC} 50%,#FB7185 100%)`,
        bgImg:
          `radial-gradient(circle at 20% 0%,rgba(251,113,133,.12) 0%,rgba(0,0,0,0) 60%),` +
          `radial-gradient(circle at 80% 120%,rgba(251,191,36,.12) 0%,rgba(0,0,0,0) 70%)`,
      };
    default:
      return baseDark;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams;
  const origin = url.origin;

  const token = q(qs, 'token');
  const variant = q(qs, 'variant', 'front').toLowerCase() === 'back' ? 'back' : 'front';
  const width = clamp(num(qs, 'width', 1200), 600, 2400);
  const dpi = clamp(num(qs, 'dpi', 300), 72, 600);

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const height = Math.round(width / CR80_RATIO);

  const name = q(qs, 'name').slice(0, 80);
  const title = q(qs, 'title').slice(0, 80);
  const company = q(qs, 'company').slice(0, 80);
  const label = normalizeRole(q(qs, 'label', 'ATTENDEE'));
  const eventTitle = q(qs, 'eventTitle').slice(0, 120);
  const eventTime = q(qs, 'eventTime').slice(0, 120);

  const orgName =
    q(qs, 'org') ||
    q(qs, 'organizer') ||
    q(qs, 'organizerName') ||
    q(qs, 'tenant') ||
    q(qs, 'brandName') ||
    eventTitle ||
    'Verified';

  const templateRaw = q(qs, 'template', 'midnight_gold');
  const template = ALLOW_TPL.has(templateRaw as any) ? templateRaw : 'midnight_gold';
  const accent = safeHex(q(qs, 'accent', '')) || '';
  const bgHint = q(qs, 'bg', '');

  const logoUrl = safeAssetUrl(origin, qs.get('logoUrl'));
  const sponsorUrl = safeAssetUrl(origin, qs.get('sponsorLogoUrl') || qs.get('sponsor'));

  const pad = Math.round(width * 0.045);
  const qrSize = Math.round(width * (variant === 'front' ? 0.22 : 0.55));
  const gap = Math.round(width * 0.025);
  const radius = Math.round(width * 0.03);
  const fontLg = Math.round(width * 0.065);
  const fontMd = Math.round(width * 0.038);
  const fontSm = Math.round(width * 0.030);
  const fontXs = Math.round(width * 0.024);

  const theme = themeFor(template, bgHint, accent);

  // --- Assets ---
  let qrAB: ArrayBuffer | null = null;
  if (variant === 'front') {
    try {
      const qrUrl = `${origin}/api/qr?data=${encodeURIComponent(token)}&size=${Math.round(qrSize * 0.92)}&margin=0`;
      const res = await fetch(qrUrl, { cache: 'no-store', headers: { accept: 'image/png' } });
      if (res.ok) qrAB = await res.arrayBuffer();
    } catch {}
  }

  let sponsorAB: ArrayBuffer | null = null;
  if (variant === 'back' && sponsorUrl) {
    try {
      const res = await fetch(sponsorUrl, { cache: 'no-store' });
      if (res.ok) sponsorAB = await res.arrayBuffer();
    } catch {}
  }

  let logoAB: ArrayBuffer | null = null;
  if (variant === 'front' && logoUrl) {
    try {
      const res = await fetch(logoUrl, { cache: 'no-store' });
      if (res.ok) logoAB = await res.arrayBuffer();
    } catch {}
  }

  const HeaderChip = (
    <div
      style={{
        display: 'flex',
        fontWeight: 900,
        fontSize: fontXs,
        color: theme.chipText,
        background: theme.chipBg,
        padding: '6px 10px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,.35)',
        boxShadow: '0 10px 26px rgba(0,0,0,.22)',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      }}
    >
      {label}
    </div>
  );

  const BrandLogo = logoAB ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoAB as any}
      alt="Logo"
      width={Math.round(width * 0.18)}
      height={Math.round(height * 0.12)}
      style={{
        display: 'block',
        maxHeight: Math.round(height * 0.14),
        width: 'auto',
        borderRadius: Math.round(radius * 0.45),
        border: '1px solid rgba(0,0,0,.12)',
      }}
    />
  ) : (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(width * 0.01),
        padding: `${Math.round(height * 0.008)}px ${Math.round(width * 0.012)}px`,
        borderRadius: 999,
        border: `1px solid ${theme.line}`,
        background:
          'linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.04) 45%, rgba(0,0,0,.12) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,.10), inset 0 -10px 20px rgba(0,0,0,.20), 0 10px 22px rgba(0,0,0,.25)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: Math.round(width * 0.012),
          height: Math.round(width * 0.012),
          borderRadius: 999,
          background: theme.chipBg,
          boxShadow: '0 6px 16px rgba(0,0,0,.35)',
          border: '1px solid rgba(255,255,255,.25)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.0 }}>
        <div
          style={{
            fontWeight: 950,
            letterSpacing: 2.0,
            fontSize: Math.max(10, Math.round(fontXs * 0.92)),
            textTransform: 'uppercase',
            color: theme.textMain,
            textShadow: '0 1px 0 rgba(0,0,0,.35)',
          }}
        >
          AURUMPASS
        </div>
        <div
          style={{
            marginTop: 2,
            fontWeight: 800,
            letterSpacing: 1.2,
            fontSize: Math.max(9, Math.round(fontXs * 0.62)),
            textTransform: 'uppercase',
            color: theme.textSub,
            opacity: 0.92,
            maxWidth: Math.round(width * 0.30),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={orgName || 'Verified'}
        >
          {(orgName || 'Verified').slice(0, 42)}
        </div>
      </div>
    </div>
  );

  const BodyFront = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap,
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(gap * 0.6), flex: 1 }}>
        {name ? (
          <div style={{ display: 'block', fontSize: fontLg, fontWeight: 900, lineHeight: 1.0, color: theme.textMain }}>
            {name}
          </div>
        ) : null}
        {title ? (
          <div style={{ display: 'block', fontSize: fontMd, fontWeight: 700, color: theme.textSub }}>{title}</div>
        ) : null}
        {company ? (
          <div
            style={{
              display: 'block',
              fontSize: fontSm,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              color: theme.textMain,
              opacity: 0.92,
            }}
          >
            {company}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          width: qrSize,
          height: qrSize,
          background: '#fff',
          borderRadius: Math.round(radius * 0.6),
          border: '1px solid rgba(0,0,0,.22)',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.qrShadow,
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
            style={{ display: 'block', borderRadius: 8 }}
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
              borderRadius: 8,
              fontSize: fontXs,
              fontWeight: 800,
            }}
          >
            QR UNAVAILABLE
          </div>
        )}
      </div>
    </div>
  );

  // ✅ premium fallback instead of “Missing sponsor logo”
  const BodyBack = (
    <div
      style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {sponsorAB ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sponsorAB as any}
          alt="Sponsor"
          width={Math.round(width * 0.50)}
          height={Math.round(height * 0.50)}
          style={{ display: 'block', borderRadius: Math.round(radius * 0.55) }}
        />
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${theme.line}`,
            background: 'rgba(255,255,255,.06)',
            maxWidth: Math.round(width * 0.72),
          }}
        >
          <div style={{ fontSize: fontXs, color: theme.textSub, letterSpacing: 2.2, fontWeight: 900, textTransform: 'uppercase' }}>
            Verified Entry Pass
          </div>
          <div style={{ fontSize: fontSm, color: theme.textMain, fontWeight: 900 }}>
            {orgName}
          </div>
          <div style={{ fontSize: fontXs, color: theme.textSub }}>
            Present this badge at entry • Scan QR on the front
          </div>
          <div style={{ fontSize: Math.max(9, Math.round(fontXs * 0.9)), color: theme.textSub, opacity: 0.9 }}>
            Ref: {token.length > 14 ? `${token.slice(0, 6)}…${token.slice(-4)}` : token}
          </div>
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
        backgroundColor: theme.bg,
        backgroundImage: theme.bgImg,
        borderRadius: radius,
        border: theme.border,
        color: theme.textMain,
        boxShadow: theme.inset,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: gap,
          paddingBottom: Math.round(gap * 0.6),
          borderBottom: `1px solid ${theme.line}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {HeaderChip}
          {BrandLogo}
        </div>
        <div style={{ display: 'flex', fontSize: fontXs, color: theme.textSub }}>
          {dpi} DPI • CR80 86×54mm
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>{variant === 'front' ? BodyFront : BodyBack}</div>

      {variant === 'front' && (eventTitle || eventTime) ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: gap,
            paddingTop: Math.round(gap * 0.6),
            borderTop: `1px solid ${theme.line}`,
            color: theme.textSub,
            fontSize: fontXs,
          }}
        >
          <div style={{ display: 'block', fontWeight: 800, color: theme.textMain }}>{eventTitle}</div>
          <div style={{ display: 'block' }}>{eventTime}</div>
        </div>
      ) : null}
    </div>
  );

  return new ImageResponse(card, { width, height });
}
