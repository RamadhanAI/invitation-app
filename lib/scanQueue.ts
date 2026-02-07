// lib/scanQueue.ts
export type QueuedScan = {
  id: string;
  slug: string;
  token: string;
  action?: 'IN' | 'OUT';
  at: number;
};

const keyFor = (slug: string) => `scanQueue:${slug}`;

function uid() {
  return (crypto as any)?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

export function enqueueScan(slug: string, token: string, action: 'IN' | 'OUT' = 'IN') {
  const key = keyFor(slug);
  const q: QueuedScan[] = JSON.parse(localStorage.getItem(key) || '[]');
  q.push({ id: uid(), slug, token, action, at: Date.now() });
  localStorage.setItem(key, JSON.stringify(q.slice(-500)));
}

export function getQueueSize(slug: string) {
  const key = keyFor(slug);
  const q: QueuedScan[] = JSON.parse(localStorage.getItem(key) || '[]');
  return q.length;
}

export async function flushQueue(slug: string) {
  const key = keyFor(slug);
  const q: QueuedScan[] = JSON.parse(localStorage.getItem(key) || '[]');
  if (!q.length) return 0;

  const kept: QueuedScan[] = [];
  for (const item of q) {
    try {
      const res = await fetch('/api/scanner/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: item.token, action: item.action }),
      });
      if (!res.ok) kept.push(item);
    } catch {
      kept.push(item);
    }
  }

  localStorage.setItem(key, JSON.stringify(kept));
  return q.length - kept.length;
}
