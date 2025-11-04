'use client';

import { useEffect, useRef } from 'react';

type Props = {
  children: React.ReactNode;
  /** bump to trigger a brief glow/tilt pulse when inputs change */
  pulseKey?: number | string;
  /** optional: force reduced motion */
  reduceMotion?: boolean;
  className?: string;
};

export default function BadgePedestal({
  children,
  pulseKey,
  reduceMotion = false,
  className = '',
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;
    el.classList.remove('pedestal-pulse');
    // force reflow so animation restarts even if key repeats quickly
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetHeight;
    el.classList.add('pedestal-pulse');
    const t = setTimeout(() => el.classList.remove('pedestal-pulse'), 500);
    return () => clearTimeout(t);
  }, [pulseKey]);

  return (
    <div
      className={`pedestal ${reduceMotion ? 'pedestal--reduced' : ''} ${className}`}
      aria-label="Badge display pedestal"
    >
      <div ref={cardRef} className="pedestal-card">
        {children}
      </div>
    </div>
  );
}
