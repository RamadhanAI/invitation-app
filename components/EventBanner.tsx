// components/EventBanner.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type Position = 'header' | 'footer';
type BrandLike = { banners?: { header?: { url?: string; href?: string }; footer?: { url?: string; href?: string }; version?: string | number } };

const exts = ['webp','png','jpg','jpeg','svg'] as const;

function buildCandidates(slug: string, position: Position, brand?: BrandLike | null) {
  const urls: string[] = [];
  const v = brand?.banners?.version ? `?v=${encodeURIComponent(String(brand.banners.version))}` : '';
  const override = brand?.banners?.[position]?.url?.trim();
  if (override) urls.push(override);
  for (const ext of exts) urls.push(`/banners/${slug}-${position}.${ext}${v}`);
  for (const ext of exts) urls.push(`/banners/default-${position}.${ext}${v}`);
  return Array.from(new Set(urls));
}

export default function EventBanner({
  slug, position, brand, height, className = '', clickableHref, alt,
}: {
  slug: string; position: Position; brand?: BrandLike | null; height?: number; className?: string; clickableHref?: string; alt?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const tried = useRef<string[]>([]);
  const candidates = useMemo(() => buildCandidates(slug, position, brand), [slug, position, brand]);
  const desiredMaxH = height ?? (position === 'header' ? 180 : 140);

  useEffect(() => { setIdx(0); tried.current = []; setSrc(candidates[0] || null); }, [candidates]);
  if (!src) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? `${position} banner`}
      className="block w-auto h-auto max-w-full"
      style={{ maxHeight: desiredMaxH }}
      onError={() => {
        tried.current.push(src);
        const next = candidates[idx + 1];
        if (next) { setIdx((i) => i + 1); setSrc(next); } else { setSrc(null); }
      }}
    />
  );
  const href = clickableHref || (brand?.banners?.[position]?.href ?? '');
  return (
    <div className={`w-full flex items-center justify-center overflow-hidden ${className}`} style={{ padding: position === 'header' ? '12px 0' : '16px 0' }}>
      {href ? <a href={href} target="_blank" rel="noreferrer noopener">{img}</a> : img}
    </div>
  );
}
