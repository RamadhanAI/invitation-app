'use client';

import { useMemo, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type BadgeConfig = {
  template?: string; // 'midnight_gold' | 'pearl_white' | 'emerald_elite' | 'carbon_vip' | etc
  accent?: string; // hex like #D4AF37
  bg?: string; // optional semantic bg key
  sponsorLogoUrl?: string;
  logoUrl?: string;
};

type Props = {
  width: number;
  token?: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  role: string;

  // legacy
  sponsorLogoUrl?: string;

  // new (additive)
  badge?: BadgeConfig;
};

function isHexColor(v?: string) {
  if (!v) return false;
  const s = v.trim();
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(s);
}

export default function BadgePreviewFlip({
  width,
  token,
  fullName,
  jobTitle,
  companyName,
  role,
  sponsorLogoUrl,
  badge,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  const toggle = useCallback(() => setFlipped((v) => !v), []);
  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const shortRef = token
    ? token.length > 14
      ? `${token.slice(0, 6)}…${token.slice(-4)}`
      : token
    : '••••••';

  const roleText = (role || 'ATTENDEE').toUpperCase();
  const isVIP = roleText === 'VIP';

  const cardH = Math.round(width * (628 / 1000));
  const qrValue = useMemo(() => token || 'DEMO-TOKEN', [token]);

  // ---- badge config (new) ----
  const template = (badge?.template || 'midnight_gold').toLowerCase();
  const accent = isHexColor(badge?.accent) ? (badge!.accent as string) : '#D4AF37';

  // Sponsor logo precedence: explicit prop → badge config
  const sponsor = (sponsorLogoUrl || badge?.sponsorLogoUrl || '').trim() || undefined;
  const logoUrl = (badge?.logoUrl || '').trim() || undefined;

  // Theme tokens
  const theme = useMemo(() => {
    if (template === 'pearl_white') {
      return {
        surface: 'rgba(255,255,255,0.92)',
        surface2: 'rgba(255,255,255,0.86)',
        border: 'rgba(17,24,39,0.18)',
        glow: 'rgba(0,0,0,0.08)',
        text: '#0b1220',
        textMuted: 'rgba(15,23,42,0.60)',
        textSoft: 'rgba(15,23,42,0.42)',
        qrWrap: 'rgba(15,23,42,0.06)',
      };
    }
    if (template === 'emerald_elite') {
      return {
        surface: 'rgba(6,12,10,0.92)',
        surface2: 'rgba(6,12,10,0.88)',
        border: 'rgba(16,185,129,0.22)',
        glow: 'rgba(16,185,129,0.14)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.72)',
        textSoft: 'rgba(255,255,255,0.50)',
        qrWrap: 'rgba(0,0,0,0.40)',
      };
    }
    if (template === 'carbon_vip') {
      return {
        surface: 'rgba(8,10,12,0.94)',
        surface2: 'rgba(8,10,12,0.90)',
        border: 'rgba(255,255,255,0.14)',
        glow: 'rgba(255,255,255,0.06)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.72)',
        textSoft: 'rgba(255,255,255,0.48)',
        qrWrap: 'rgba(0,0,0,0.40)',
      };
    }
    // default: midnight_gold
    return {
      surface: 'rgba(0,0,0,0.88)',
      surface2: 'rgba(0,0,0,0.86)',
      border: 'rgba(212,175,55,0.38)',
      glow: 'rgba(212,175,55,0.18)',
      text: '#ffffff',
      textMuted: 'rgba(255,255,255,0.72)',
      textSoft: 'rgba(255,255,255,0.48)',
      qrWrap: 'rgba(0,0,0,0.40)',
    };
  }, [template]);

  // Background glow per template/accent
  const bgGlow = useMemo(() => {
    const a = accent;
    if (template === 'pearl_white') {
      return `
        radial-gradient(circle at 20% 10%, rgba(212,175,55,.18) 0%, rgba(255,255,255,0) 60%),
        radial-gradient(circle at 85% 120%, rgba(15,23,42,.08) 0%, rgba(255,255,255,0) 70%)
      `;
    }
    if (template === 'emerald_elite') {
      return `
        radial-gradient(circle at 20% 10%, rgba(16,185,129,.18) 0%, rgba(0,0,0,0) 60%),
        radial-gradient(circle at 85% 120%, rgba(212,175,55,.10) 0%, rgba(0,0,0,0) 70%)
      `;
    }
    if (template === 'carbon_vip') {
      return `
        radial-gradient(circle at 20% 10%, rgba(255,255,255,.08) 0%, rgba(0,0,0,0) 60%),
        radial-gradient(circle at 85% 120%, rgba(255,255,255,.04) 0%, rgba(0,0,0,0) 70%)
      `;
    }
    return `
      radial-gradient(circle at 20% 10%, ${a}33 0%, rgba(0,0,0,0) 60%),
      radial-gradient(circle at 80% 120%, ${a}14 0%, rgba(0,0,0,0) 70%)
    `;
  }, [template, accent]);

  // Role chip colors: readable on light cards
  const roleTextGradient =
    template === 'pearl_white'
      ? 'linear-gradient(180deg, #0b1220 0%, #334155 45%, #0b1220 100%)'
      : 'linear-gradient(180deg, #FFF7C4 0%, #E8C969 36%, #B89122 70%, #7A5C12 100%)';

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ width, height: cardH, perspective: '1400px' }}
      onClick={toggle}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label="Flip badge"
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transition: 'transform .6s cubic-bezier(.16,1,.3,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ✅ IMPORTANT: keep oscillation on a wrapper that does NOT rotateY/rotateX */}
        <div className="w-full h-full lux-oscillate" style={{ transformStyle: 'preserve-3d' as any }}>
          {/* FRONT */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'translateZ(0)', // ✅ Safari backface stability
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              boxShadow: `0 30px 80px rgba(0,0,0,.65), 0 0 120px ${theme.glow}`,
            }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: bgGlow }} />

            {/* subtle holo band */}
            <div
              className="absolute -left-10 -right-10 top-1/4 h-20 rotate-[-20deg] opacity-[0.16] mix-blend-screen holo-anim pointer-events-none"
              style={{
                background:
                  'linear-gradient(110deg,#00f0ff 0%,#ff00f0 30%,#fff08a 60%,#00f0ff 100%)',
                backgroundSize: '200% 200%',
                border: `1px solid rgba(255,255,255,.22)`,
                borderRadius: '12px',
                filter: 'saturate(0.9) brightness(0.95)',
              }}
            />

            {/* Role chip */}
            <div className="absolute z-20 left-4 top-3">
              <span
                className={['role-pill inline-flex items-center justify-center', isVIP ? 'role-pill--vip' : 'role-pill--std'].join(
                  ' '
                )}
                style={{
                  borderColor: template === 'pearl_white' ? 'rgba(15,23,42,.18)' : 'rgba(212,175,55,.55)',
                }}
              >
                <span className="role-glow" />
                <span className="role-sheen" />
                <span
                  className="role-text"
                  style={{
                    background: roleTextGradient,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                  }}
                >
                  {roleText}
                </span>
              </span>
            </div>

            {/* Tiny ref */}
            <div className="absolute right-4 top-4 z-20 font-mono text-[10px]" style={{ color: theme.textSoft }}>
              {shortRef}
            </div>

            {/* Optional top logo */}
            {logoUrl ? (
              <div className="absolute z-20 left-4 bottom-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo" className="object-contain w-auto h-6 opacity-90" />
              </div>
            ) : null}

            <div className="relative z-10 grid w-full h-full grid-cols-12 gap-4 p-4">
              <div className="flex flex-col justify-end h-full col-span-7">
                <div
                  className="mt-6 text-xl font-extrabold leading-tight drop-shadow-[0_1px_0_rgba(0,0,0,.25)]"
                  style={{ color: theme.text }}
                >
                  {fullName || 'FULL NAME'}
                </div>
                <div className="text-[11px] font-medium leading-snug line-clamp-1" style={{ color: theme.textMuted }}>
                  {jobTitle || 'JOB TITLE'}
                </div>
                <div
                  className="text-[10px] font-semibold uppercase tracking-wide line-clamp-1"
                  style={{ color: theme.textSoft }}
                >
                  {companyName || 'COMPANY NAME'}
                </div>
              </div>

              <div className="flex items-center justify-center col-span-5">
                <div
                  className="p-3 rounded-2xl ring-1"
                  style={{
                    background: theme.qrWrap,
                    borderColor: template === 'pearl_white' ? 'rgba(15,23,42,.12)' : 'rgba(255,255,255,.10)',
                  }}
                >
                  <QRCodeSVG value={qrValue} size={Math.min(Math.floor(width * 0.38), 520)} level="M" includeMargin />
                  <p className="mt-1 text-center text-[10px]" style={{ color: theme.textSoft }}>
                    Scan at entry
                  </p>
                </div>
              </div>

              <div className="col-span-12 mt-1 text-center text-[9px]" style={{ color: theme.textSoft }}>
                Present this badge at entry
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg) translateZ(0)', // ✅ Safari stability + keeps flip
              border: `1px solid ${theme.border}`,
              background: theme.surface2,
              boxShadow: `0 30px 80px rgba(0,0,0,.65), 0 0 120px ${theme.glow}`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg,rgba(255,255,255,.5) 0px,rgba(255,255,255,0) 4px,rgba(255,255,255,0) 8px)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-6">
              <div className="mb-3 text-[10px] uppercase tracking-wide" style={{ color: theme.textSoft }}>
                Presented by
              </div>

              {sponsor ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sponsor} alt="Sponsor" className="object-contain w-auto h-14" />
              ) : (
                <div className="text-xs" style={{ color: theme.textSoft }}>
                  Sponsor
                </div>
              )}

              {token ? (
                <div className="absolute bottom-3 font-mono text-[10px]" style={{ color: theme.textSoft }}>
                  Ref: {shortRef}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* ✅ FIX: never animate rotateY/rotateX on the child wrapper (it breaks 3D flip, esp Safari) */
@keyframes luxOsc {
  0%   { transform: translateY(0px) rotateZ(-0.2deg); }
  50%  { transform: translateY(-2px) rotateZ(0.2deg); }
  100% { transform: translateY(0px) rotateZ(-0.2deg); }
}
.lux-oscillate {
  animation: luxOsc 6s ease-in-out infinite;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  will-change: transform;
}

@keyframes holoShift {
  0%   { background-position: 0% 50%; filter:hue-rotate(0deg) brightness(1); }
  50%  { background-position: 100% 50%; filter:hue-rotate(40deg) brightness(1.05); }
  100% { background-position: 0% 50%; filter:hue-rotate(0deg) brightness(1); }
}
.holo-anim { animation: holoShift 4s linear infinite; }

.role-pill {
  position: relative;
  min-width: 148px;
  height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  overflow: hidden;
  box-shadow:
    0 10px 28px rgba(0,0,0,.22),
    inset 0 0 0 1px rgba(255,255,255,.08);
  backdrop-filter: blur(2px);
  transform: translateZ(0);
  animation: rolePulse 3.8s ease-in-out infinite;
  background: rgba(0,0,0,.35);
}
.role-pill--vip {
  box-shadow:
    0 12px 30px rgba(0,0,0,.28),
    0 0 40px rgba(212,175,55,.28),
    inset 0 0 0 1px rgba(255,255,255,.12);
}
@keyframes rolePulse {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(212,175,55,0)); }
  50%      { filter: drop-shadow(0 0 10px rgba(212,175,55,.28)); }
}
.role-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 120% at 10% 20%, rgba(212,175,55,.20) 0%, rgba(0,0,0,0) 50%),
    radial-gradient(120% 120% at 80% 120%, rgba(212,175,55,.10) 0%, rgba(0,0,0,0) 70%);
  pointer-events: none;
}
.role-sheen {
  position: absolute; inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.22) 45%, transparent 60%);
  background-size: 220% 100%;
  animation: roleSheen 5.5s ease-in-out infinite;
  mix-blend-mode: screen;
  pointer-events: none;
}
@keyframes roleSheen {
  0% { background-position: -40% 0; }
  60% { background-position: 140% 0; }
  100% { background-position: 140% 0; }
}
.role-text {
  position: relative;
  z-index: 2;
  font-weight: 900;
  letter-spacing: .12em;
  font-size: 13px;
  text-transform: uppercase;
  padding-top: 1px;
  padding-bottom: 1px;
  color: transparent;
  text-shadow:
    0 1px 0 rgba(255,255,255,.35),
    0 0 12px rgba(212,175,55,.25);
}
          `,
        }}
      />
    </div>
  );
}
