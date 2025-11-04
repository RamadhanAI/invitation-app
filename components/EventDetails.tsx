// components/EventDetails.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type EventDetailsResponse = {
  title: string;
  date?: string | null;
  price?: number;     // cents
  currency?: string;
  venue?: string | null;
  capacity?: number | null;
  status?: string | null;
};

type Props = {
  slug: string;
  refreshMs?: number;
  className?: string;
};

function formatPrice(priceCents = 0, currency = 'USD') {
  if (!priceCents) return 'Free';
  const amount = priceCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function timeUntil(iso?: string | null) {
  if (!iso) return '';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return 'Live or ended';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(
    (diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
  );
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

async function fetchDetails(slug: string, signal?: AbortSignal): Promise<EventDetailsResponse> {
  const paths = [
    `/api/events/${encodeURIComponent(slug)}/details`,
    `/api/events/${encodeURIComponent(slug)}`,
  ];
  let lastErr: any = null;

  for (const url of paths) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json && typeof json === 'object' && 'title' in json) {
        return {
          title: json.title,
          date: json.date ?? null,
          price: typeof json.price === 'number' ? json.price : 0,
          currency: json.currency || 'USD',
          venue: json.venue ?? null,
          capacity: json.capacity ?? null,
          status: json.status ?? null,
        };
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Failed to load event details');
}

export default function EventDetails({ slug, refreshMs = 60_000, className = '' }: Props) {
  const [event, setEvent] = useState<EventDetailsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const priceText = useMemo(
    () => formatPrice(event?.price ?? 0, event?.currency ?? 'USD'),
    [event?.price, event?.currency]
  );
  const when = useMemo(() => formatDate(event?.date), [event?.date]);
  const countdown = useMemo(() => timeUntil(event?.date), [event?.date]);

  async function load() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDetails(slug, ac.signal);
      setEvent(data);
    } catch (e: any) {
      setError(e?.message || 'Could not load event');
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    if (!refreshMs) return;
    const id = setInterval(() => void load(), refreshMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, refreshMs]);

  if (loading) {
    return (
      <div className={`glass rounded-2xl p-4 md:p-5 ${className}`}>
        <div className="space-y-3 animate-pulse">
          <div className="w-40 h-5 rounded bg-white/10" />
          <div className="w-3/4 h-8 rounded bg-white/10" />
          <div className="w-1/2 h-4 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className={`glass rounded-2xl p-4 md:p-5 ${className}`}>
        <div className="text-sm text-red-300">
          Failed to load event. {error ? `(${error})` : ''}
        </div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-2xl p-4 md:p-5 ${className}`}>
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {event.title}
          </h1>
          <div
            className={`badge ${
              event.price ? '' : 'bg-emerald-600/20 text-emerald-300'
            }`}
            title={event.price ? 'Paid event' : 'Free entry'}
          >
            {priceText}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
          {when && <span>{when}</span>}
          {event.venue && <span>· {event.venue}</span>}
          {typeof event.capacity === 'number' && (
            <span>· Capacity {event.capacity}</span>
          )}
          {countdown && countdown !== 'Live or ended' && (
            <span className="badge">Starts in {countdown}</span>
          )}
          {event.status && <span className="badge">{event.status}</span>}
        </div>
      </div>
    </div>
  );
}
