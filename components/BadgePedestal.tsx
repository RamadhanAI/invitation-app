// components/BadgePedestal.tsx
// components/BadgePedestal.tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';

type Props = {
  children: React.ReactNode;
  pulseKey?: number | string;
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

  const shouldReduce = useMemo(() => {
    if (reduceMotion) return true;
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, [reduceMotion]);

  useEffect(() => {
    if (shouldReduce) return;
    const el = cardRef.current;
    if (!el) return;

    // Restart animation reliably
    el.classList.remove('pedestal-pulse');
    // Force reflow
    void el.offsetHeight;

    const raf = requestAnimationFrame(() => {
      el.classList.add('pedestal-pulse');
    });

    const tid = window.setTimeout(() => {
      el.classList.remove('pedestal-pulse');
    }, 560);

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
