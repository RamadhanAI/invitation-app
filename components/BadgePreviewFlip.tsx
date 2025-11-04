'use client';

import { useMemo, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Props = {
  width: number;
  token?: string;
  fullName: string;
  jobTitle: string;
  companyName: string;
  role: string;
  sponsorLogoUrl?: string;
};

export default function BadgePreviewFlip({
  width,
  token,
  fullName,
  jobTitle,
  companyName,
  role,
  sponsorLogoUrl,
}: Props) {
  const [flipped, setFlipped] = useState(false);

  const toggle = useCallback(() => setFlipped(v => !v), []);
  const onKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  const shortRef = token
    ? token.length > 14
      ? `${token.slice(0, 6)}…${token.slice(-4)}`
      : token
    : '••••••';

  const isVIP = (role || '').toUpperCase() === 'VIP';
  const roleText = (role || 'ATTENDEE').toUpperCase();

  const cardH = Math.round(width * (628 / 1000));
  const qrValue = useMemo(() => token || 'DEMO-TOKEN', [token]);

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
        <div className="w-full h-full lux-oscillate">
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,.8),0_0_120px_rgba(212,175,55,.18)] border border-[rgba(212,175,55,.38)] bg-black/90"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 10%, rgba(212,175,55,.24) 0%, rgba(0,0,0,0) 60%),
                  radial-gradient(circle at 80% 120%, rgba(212,175,55,.06) 0%, rgba(0,0,0,0) 70%)
                `,
              }}
            />
            <div
              className="absolute -left-10 -right-10 top-1/4 h-20 rotate-[-20deg] opacity-[0.18] mix-blend-screen holo-anim pointer-events-none"
              style={{
                background:
                  'linear-gradient(110deg,#00f0ff 0%,#ff00f0 30%,#fff08a 60%,#00f0ff 100%)',
                backgroundSize: '200% 200%',
                border: '1px solid rgba(255,255,255,.35)',
                borderRadius: '12px',
                filter: 'saturate(0.9) brightness(0.95)',
              }}
            />
            <div className="absolute z-20 left-4 top-3">
              <span
                className={[
                  'role-pill inline-flex items-center justify-center',
                  isVIP ? 'role-pill--vip' : 'role-pill--std',
                ].join(' ')}
              >
                <span className="role-glow" />
                <span className="role-sheen" />
                <span className="role-text">{roleText}</span>
              </span>
            </div>
            <div className="absolute right-4 top-4 z-20 font-mono text-[10px] text-white/65">
              {shortRef}
            </div>
            <div className="relative z-10 grid w-full h-full grid-cols-12 gap-4 p-4 text-white">
              <div className="flex flex-col justify-end h-full col-span-7">
                <div className="mt-6 text-xl font-extrabold leading-tight drop-shadow-[0_1px_0_rgba(0,0,0,.8)]">
                  {fullName || 'FULL NAME'}
                </div>
                <div className="text-[11px] font-medium leading-snug text-white/70 line-clamp-1">
                  {jobTitle || 'JOB TITLE'}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/50 line-clamp-1">
                  {companyName || 'COMPANY NAME'}
                </div>
              </div>
              <div className="flex items-center justify-center col-span-5">
                <div className="p-3 rounded-2xl bg-black/50 ring-1 ring-white/10">
                  <QRCodeSVG
                    value={qrValue}
                    size={Math.min(Math.floor(width * 0.38), 520)}
                    level="M"
                    includeMargin
                  />
                  <p className="mt-1 text-center text-[10px] text-white/55">
                    Scan at entry
                  </p>
                </div>
              </div>
              <div className="col-span-12 mt-1 text-center text-[9px] text-white/45">
                Present this badge at entry
              </div>
            </div>
          </div>
          <div
            className="absolute inset-0 overflow-hidden rounded-2xl border border-[rgba(212,175,55,.38)] bg-black/90 shadow-[0_30px_80px_rgba(0,0,0,.8),0_0_120px_rgba(212,175,55,.18)]"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg,rgba(255,255,255,.5) 0px,rgba(255,255,255,0) 4px,rgba(255,255,255,0) 8px)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-6 text-white">
              <div className="mb-3 text-[10px] uppercase tracking-wide text-white/55">
                Presented by
              </div>
              {sponsorLogoUrl ? (
                <img
                  src={sponsorLogoUrl}
                  alt="Sponsor"
                  className="object-contain w-auto h-14"
                />
              ) : (
                <div className="text-xs text-white/35">Sponsor</div>
              )}
              {token ? (
                <div className="absolute bottom-3 font-mono text-[10px] text-white/35">
                  Ref: {shortRef}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes luxOsc {
  0%   { transform: rotateY(-6deg) rotateX(1deg); }
  50%  { transform: rotateY(6deg)  rotateX(-1deg); }
  100% { transform: rotateY(-6deg) rotateX(1deg); }
}
.lux-oscillate { animation: luxOsc 6s ease-in-out infinite; }

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
  border: 1px solid rgba(212,175,55,.55);
  box-shadow:
    0 10px 28px rgba(212,175,55,.28),
    0 0 32px rgba(212,175,55,.25),
    inset 0 0 0 1px rgba(255,255,255,.08);
  backdrop-filter: blur(2px);
  transform: translateZ(0);
  animation: rolePulse 3.8s ease-in-out infinite;
}
.role-pill--vip {
  border-color: rgba(212,175,55,.7);
  box-shadow:
    0 12px 30px rgba(212,175,55,.36),
    0 0 40px rgba(212,175,55,.4),
    inset 0 0 0 1px rgba(255,255,255,.12);
}
.role-pill--std {
  background: rgba(0,0,0,.55);
}
@keyframes rolePulse {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(212,175,55,0)); }
  50%      { filter: drop-shadow(0 0 10px rgba(212,175,55,.35)); }
}
.role-glow {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 120% at 10% 20%, rgba(212,175,55,.28) 0%, rgba(0,0,0,0) 50%),
    radial-gradient(120% 120% at 80% 120%, rgba(212,175,55,.12) 0%, rgba(0,0,0,0) 70%);
  pointer-events: none;
}
.role-sheen {
  position: absolute; inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.25) 45%, transparent 60%);
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
  color: #0b0b0b;
  text-transform: uppercase;
  padding-top: 1px;
  padding-bottom: 1px;
  background: linear-gradient(180deg, #FFF7C4 0%, #E8C969 36%, #B89122 70%, #7A5C12 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow:
    0 1px 0 rgba(255,255,255,.5),
    0 0 12px rgba(212,175,55,.35);
}
          `,
        }}
      />
    </div>
  );
}
