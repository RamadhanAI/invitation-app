// components/BadgePedestal.tsx
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

  // Respect user/system preference in addition to the prop
  const shouldReduce =
    reduceMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ||
    false;

  useEffect(() => {
    if (shouldReduce) return; // no pulse if reduced motion requested
    const el = cardRef.current;
    if (!el) return;

    // Restart the pulse animation safely
    el.classList.remove('pedestal-pulse');

    // Force reflow so the animation reliably restarts even on rapid changes
    void el.offsetHeight;

    // Add on next frame for consistent style flush
    const raf = requestAnimationFrame(() => {
      el.classList.add('pedestal-pulse');
    });

    // Ensure it doesn’t get stuck if key changes rapidly
    const tid = window.setTimeout(() => {
      el.classList.remove('pedestal-pulse');
    }, 520);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tid);
      el.classList.remove('pedestal-pulse');
    };
  }, [pulseKey, shouldReduce]);

  return (
    <div
      className={`pedestal ${shouldReduce ? 'pedestal--reduced' : ''} ${className}`.trim()}
      aria-label="Badge display pedestal"
    >
      <div ref={cardRef} className="pedestal-card">
        {children}
      </div>
    </div>
  );
}
