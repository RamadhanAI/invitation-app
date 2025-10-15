// lib/scanQueue.ts
// lib/scanQueue.ts
export type QueuedItem = { token: string; scannerId: string; at: number };

const keyFor = (slug: string) => `scanQueue:${slug}`;

export function enqueueScan(slug: string, token: string, scannerId: string, at?: number) {
  if (!slug) return;
  const key = keyFor(slug);
  const q: QueuedItem[] = JSON.parse(localStorage.getItem(key) || '[]');
  q.push({ token, scannerId, at: at ?? Date.now() });
  localStorage.setItem(key, JSON.stringify(q));
}

export async function flushQueue(slug: string): Promise<number> {
  if (!slug) return 0;
  const key = keyFor(slug);
  const scannerKey = localStorage.getItem('SCANNER_KEY') || '';
  const q: QueuedItem[] = JSON.parse(localStorage.getItem(key) || '[]');
  if (!q.length) return 0;

  const kept: QueuedItem[] = [];
  for (const item of q) {
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${scannerKey}`,
        },
        body: JSON.stringify({ token: item.token, attended: true, scannerId: item.scannerId }),
      });
      if (!res.ok) kept.push(item);
    } catch {
      kept.push(item);
    }
  }
  localStorage.setItem(key, JSON.stringify(kept));
  return q.length - kept.length;
}

export function startQueueFlusher(slug: string, intervalMs = 5000) {
  let stopped = false;
  const tick = () => { if (!stopped) void flushQueue(slug); };

  const id = window.setInterval(tick, intervalMs);
  tick(); // first run

  const onFocus = () => tick();
  window.addEventListener('focus', onFocus);

  return () => {
    stopped = true;
    window.clearInterval(id);
    window.removeEventListener('focus', onFocus);
  };
}
