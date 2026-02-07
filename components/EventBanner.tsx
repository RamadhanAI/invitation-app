// components/EventBanner.tsx
// components/EventBanner.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Position = 'header' | 'footer';

type BrandLike = {
  banners?: {
    header?: { url?: string; href?: string };
    footer?: { url?: string; href?: string };
    version?: string | number;
  };
};

type Overlay = {
  title?: string;
  subtitle?: string;
  /** Optional right-side emblem image (if you want). If omitted, we render a clean SVG emblem. */
  emblemUrl?: string;
};

const exts = ['webp', 'png', 'jpg', 'jpeg', 'svg'] as const;

function withVersion(url: string, version?: string | number) {
  const v = version ? `v=${encodeURIComponent(String(version))}` : '';
  if (!v) return url;
  return url.includes('?') ? `${url}&${v}` : `${url}?${v}`;
}

function buildCandidates(slug: string, position: Position, brand?: BrandLike | null) {
  const urls: string[] = [];
  const version = brand?.banners?.version;

  const override = brand?.banners?.[position]?.url?.trim();
  if (override) urls.push(withVersion(override, version));

  for (const ext of exts) urls.push(withVersion(`/banners/${slug}-${position}.${ext}`, version));
  for (const ext of exts) urls.push(withVersion(`/banners/default-${position}.${ext}`, version));

  return Array.from(new Set(urls));
}

function addSuffixBeforeExt(url: string, suffix: string) {
  const [path, query = ''] = url.split('?');
  const dot = path.lastIndexOf('.');
  if (dot === -1) return url;
  const base = path.slice(0, dot);
  const ext = path.slice(dot);
  const next = `${base}${suffix}${ext}`;
  return query ? `${next}?${query}` : next;
}

/**
 * If you provide files like:
 * /banners/aurumpass-header.webp
 * /banners/aurumpass-header@2x.webp
 * /banners/aurumpass-header@3x.webp
 * …the browser will pick the sharpest automatically.
 */
function buildSrcSet(src: string) {
  if (!src) return undefined;
  if (src.toLowerCase().includes('.svg')) return undefined;
  const src2x = addSuffixBeforeExt(src, '@2x');
  const src3x = addSuffixBeforeExt(src, '@3x');
  return `${src} 1x, ${src2x} 2x, ${src3x} 3x`;
}

function DefaultEmblem({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className="opacity-90">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.45" stopColor="#E6C869" />
          <stop offset="1" stopColor="#9A7420" />
        </linearGradient>
      </defs>

      <rect
        x="10"
        y="10"
        width="76"
        height="76"
        rx="14"
        fill="rgba(0,0,0,0.25)"
        stroke="url(#gold)"
        strokeWidth="2"
      />

      {/* “QR-chip” vibes */}
      <rect x="22" y="22" width="18" height="18" rx="4" fill="none" stroke="url(#gold)" strokeWidth="2" />
      <rect x="56" y="22" width="18" height="18" rx="4" fill="none" stroke="url(#gold)" strokeWidth="2" />
      <rect x="22" y="56" width="18" height="18" rx="4" fill="none" stroke="url(#gold)" strokeWidth="2" />

      <rect x="48" y="48" width="6" height="6" rx="1.5" fill="url(#gold)" opacity="0.9" />
      <rect x="60" y="50" width="10" height="4" rx="2" fill="url(#gold)" opacity="0.75" />
      <rect x="50" y="62" width="20" height="4" rx="2" fill="url(#gold)" opacity="0.65" />
      <rect x="50" y="70" width="12" height="4" rx="2" fill="url(#gold)" opacity="0.55" />
    </svg>
  );
}

export default function EventBanner({
  slug,
  position,
  brand,
  height,
  className = '',
  clickableHref,
  alt,
  mode = 'image',
  overlay,
}: {
  slug: string;
  position: Position;
  brand?: BrandLike | null;
  height?: number;
  className?: string;
  clickableHref?: string;
  alt?: string;

  /** New (additive): render crisp HTML text overlay instead of relying on baked text inside the image */
  mode?: 'image' | 'overlay';
  overlay?: Overlay;
}) {
  const [idx, setIdx] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [bgOk, setBgOk] = useState(true);

  const tried = useRef<string[]>([]);
  const candidates = useMemo(() => buildCandidates(slug, position, brand), [slug, position, brand]);

  const desiredMaxH = height ?? (position === 'header' ? 180 : 140);
  const href = clickableHref || (brand?.banners?.[position]?.href ?? '');

  useEffect(() => {
    setIdx(0);
    tried.current = [];
    setBgOk(true);
    setSrc(candidates[0] || null);
  }, [candidates]);

  // ----------------------------
  // OVERLAY MODE (razor sharp)
  // ----------------------------
  if (mode === 'overlay') {
    const title = overlay?.title || 'AurumPass';
    const subtitle =
      overlay?.subtitle || 'Luxury Ticketing • Instant Check-In • Cinematic Badges';

    const bgSrc = src; // use existing banner as blurred backdrop (if available)

    const content = (
      <div
        className={[
          'relative w-full overflow-hidden rounded-2xl',
          'a-card banana-sheen-hover',
          className,
        ].join(' ')}
        style={{
          minHeight: Math.min(desiredMaxH, position === 'header' ? 160 : 120),
        }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0">
          {/* Fallback gradient (always crisp) */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 120% at 20% 10%, rgba(183,224,0,0.12) 0%, rgba(139,92,246,0.10) 35%, rgba(0,0,0,0.88) 100%)',
            }}
          />

          {/* Optional blurred image backdrop */}
          {bgSrc && bgOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bgSrc}
              srcSet={buildSrcSet(bgSrc)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-[1.12]"
              style={{
                filter: 'blur(18px) saturate(1.1) brightness(0.85)',
                opacity: 0.55,
              }}
              onError={() => setBgOk(false)}
              decoding="async"
            />
          )}

          {/* Soft vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(90%_140%_at_0%_0%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_55%)]" />
        </div>

        {/* Foreground */}
        <div className="relative z-10 flex items-center justify-between gap-6 px-6 py-5 md:px-8">
          <div className="min-w-0">
            <div
              className={[
                'font-extrabold tracking-tight',
                position === 'header' ? 'text-3xl md:text-5xl' : 'text-2xl md:text-4xl',
              ].join(' ')}
              style={{
                background:
                  'linear-gradient(180deg, #FFF7C4 0%, #E8C969 36%, #B89122 70%, #7A5C12 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: '0 0 18px rgba(212,175,55,0.18)',
              }}
            >
              {title}
            </div>

            <div className="inline-flex items-center max-w-full px-4 py-2 mt-3 text-sm border rounded-full border-white/10 bg-white/10 text-white/90 backdrop-blur">
              <span className="truncate">{subtitle}</span>
            </div>
          </div>

          <div className="items-center justify-center hidden sm:flex shrink-0">
            {overlay?.emblemUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={overlay.emblemUrl}
                alt="Brand emblem"
                className="object-contain w-16 h-16"
              />
            ) : (
              <DefaultEmblem size={72} />
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div
        className="flex items-center justify-center w-full overflow-hidden"
        style={{ padding: position === 'header' ? '12px 0' : '16px 0' }}
      >
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="w-full">
            {content}
          </a>
        ) : (
          <div className="w-full">{content}</div>
        )}
      </div>
    );
  }

  // ----------------------------
  // IMAGE MODE (original behavior, plus srcSet)
  // ----------------------------
  if (!src) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={buildSrcSet(src)}
      sizes="(max-width: 768px) 100vw, 1400px"
      alt={alt ?? `${position} banner`}
      className="block w-auto h-auto max-w-full"
      style={{ maxHeight: desiredMaxH }}
      loading={position === 'header' ? 'eager' : 'lazy'}
      fetchPriority={position === 'header' ? 'high' : 'auto'}
      decoding="async"
      onError={() => {
        tried.current.push(src);
        const next = candidates[idx + 1];
        if (next) {
          setIdx((i) => i + 1);
          setSrc(next);
        } else {
          setSrc(null);
        }
      }}
    />
  );

  return (
    <div
      className={`w-full flex items-center justify-center overflow-hidden ${className}`}
      style={{ padding: position === 'header' ? '12px 0' : '16px 0' }}
    >
      {href ? (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}
